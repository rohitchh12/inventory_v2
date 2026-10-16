import express from "express";
import cors from "cors";
import pool from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Backend and PostgreSQL are connected",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| MATERIALS
|--------------------------------------------------------------------------
*/

app.get("/api/materials", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        item_code,
        item_details,
        items_group,
        unit
      FROM materials
      ORDER BY item_code
    `);

    res.json({
      success: true,
      materials: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch materials:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch materials",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET CONSUMPTIONS
|--------------------------------------------------------------------------
|
| Returns consumption records together with their veneer/material items.
|
*/

app.get("/api/consumptions", async (req, res) => {
  try {
    const consumptionResult = await pool.query(`
      SELECT
        id,
        consumption_date,
        order_no,
        item_no,
        item_name,
        employee_name,
        created_at
      FROM consumptions
      ORDER BY id DESC
    `);

    const itemResult = await pool.query(`
      SELECT
        ci.id,
        ci.consumption_id,
        ci.material_id,
        ci.quantity,
        ci.unit,
        m.item_code,
        m.item_details,
        m.items_group
      FROM consumption_items ci
      INNER JOIN materials m
        ON m.id = ci.material_id
      ORDER BY ci.id
    `);

    const itemsByConsumption = {};

    for (const item of itemResult.rows) {
      if (!itemsByConsumption[item.consumption_id]) {
        itemsByConsumption[item.consumption_id] = [];
      }

      itemsByConsumption[item.consumption_id].push({
        id: item.id,
        materialId: item.material_id,
        code: item.item_code,
        name: item.item_details,
        group: item.items_group,
        quantity: Number(item.quantity),
        unit: item.unit,
      });
    }

    const consumptions = consumptionResult.rows.map(
      (consumption) => ({
        id: consumption.id,
        date: consumption.consumption_date,
        orderNo: consumption.order_no,
        itemNo: consumption.item_no,
        itemName: consumption.item_name,
        employeeName: consumption.employee_name,
        veneers:
          itemsByConsumption[consumption.id] || [],
        createdAt: consumption.created_at,
      })
    );

    res.json({
      success: true,
      consumptions,
    });
  } catch (error) {
    console.error("Failed to fetch consumptions:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch consumptions",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE CONSUMPTION
|--------------------------------------------------------------------------
|
| Creates:
|
| 1. consumptions
| 2. consumption_items
| 3. stock_movements with movement_type = CONSUMPTION
|
| Everything happens inside ONE PostgreSQL transaction.
|
*/

app.post("/api/consumptions", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
  date,
  orderNo,
  itemNo,
  itemName,
  employeeName,
  veneers,
  forceDuplicate,
} = req.body;

    /*
    |--------------------------------------------------------------------------
    | BASIC VALIDATION
    |--------------------------------------------------------------------------
    */

    const cleanDate = String(date || "").trim();
    const cleanOrderNo = String(orderNo || "").trim();
    const cleanItemNo = String(itemNo || "").trim();
    const cleanItemName = String(itemName || "").trim();
    const cleanEmployeeName = String(employeeName || "").trim();

    if (!cleanDate) {
      return res.status(400).json({
        success: false,
        message: "Consumption date is required.",
      });
    }

    if (!cleanOrderNo) {
      return res.status(400).json({
        success: false,
        message: "Order No. is required.",
      });
    }

    if (!cleanItemNo) {
      return res.status(400).json({
        success: false,
        message: "Item No. is required.",
      });
    }

    if (!cleanItemName) {
      return res.status(400).json({
        success: false,
        message: "Item Name is required.",
      });
    }

    if (!cleanEmployeeName) {
      return res.status(400).json({
        success: false,
        message: "Employee Name is required.",
      });
    }

    if (!Array.isArray(veneers) || veneers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one veneer is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CLEAN AND VALIDATE VENEERS
    |--------------------------------------------------------------------------
    */

    const cleanVeneers = [];

    for (const veneer of veneers) {
      const materialId = Number(veneer.materialId);
      const quantity = Number(veneer.quantity);

      if (
        !Number.isInteger(materialId) ||
        materialId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid material selected.",
        });
      }

      if (
        Number.isNaN(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Each veneer quantity must be greater than 0.",
        });
      }

      cleanVeneers.push({
        materialId,
        quantity,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | START DATABASE TRANSACTION
    |--------------------------------------------------------------------------
    */

    await client.query("BEGIN");

    /*
    |--------------------------------------------------------------------------
    | CHECK DUPLICATE
    |--------------------------------------------------------------------------
    */

    if (!forceDuplicate) {
  const duplicateResult = await client.query(
    `
      SELECT id
      FROM consumptions
      WHERE LOWER(TRIM(order_no)) = LOWER(TRIM($1))
        AND LOWER(TRIM(item_no)) = LOWER(TRIM($2))
      LIMIT 1
    `,
    [cleanOrderNo, cleanItemNo]
  );

  if (duplicateResult.rows.length > 0) {
    await client.query("ROLLBACK");

    return res.status(409).json({
      success: false,
      duplicate: true,
      message: `Order No. ${cleanOrderNo} + Item No. ${cleanItemNo} already exists.`,
    });
  }
}

    /*
    |--------------------------------------------------------------------------
    | VERIFY MATERIALS
    |--------------------------------------------------------------------------
    |
    | We don't trust material name/unit/code sent from React.
    | PostgreSQL remains the source of truth.
    |
    */

    const materialIds = [
      ...new Set(
        cleanVeneers.map(
          (veneer) => veneer.materialId
        )
      ),
    ];

    const materialResult = await client.query(
      `
      SELECT
        id,
        item_code,
        item_details,
        items_group,
        unit
      FROM materials
      WHERE id = ANY($1::int[])
      `,
      [materialIds]
    );

    if (
      materialResult.rows.length !==
      materialIds.length
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "One or more selected materials do not exist.",
      });
    }

    const materialsMap = new Map();

    for (const material of materialResult.rows) {
      materialsMap.set(
        Number(material.id),
        material
      );
    }

    /*
    |--------------------------------------------------------------------------
    | INSERT MAIN CONSUMPTION
    |--------------------------------------------------------------------------
    */

    const consumptionResult = await client.query(
      `
      INSERT INTO consumptions (
        consumption_date,
        order_no,
        item_no,
        item_name,
        employee_name
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        consumption_date,
        order_no,
        item_no,
        item_name,
        employee_name,
        created_at
      `,
      [
        cleanDate,
        cleanOrderNo,
        cleanItemNo,
        cleanItemName,
        cleanEmployeeName,
      ]
    );

    const consumption =
      consumptionResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | INSERT CONSUMPTION ITEMS + STOCK MOVEMENTS
    |--------------------------------------------------------------------------
    */

    const savedItems = [];

    for (const veneer of cleanVeneers) {
      const material =
        materialsMap.get(veneer.materialId);

      /*
      |--------------------------------------------------------------
      | Insert consumption_items
      |--------------------------------------------------------------
      */

      const itemResult = await client.query(
        `
        INSERT INTO consumption_items (
          consumption_id,
          material_id,
          quantity,
          unit
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          consumption_id,
          material_id,
          quantity,
          unit
        `,
        [
          consumption.id,
          material.id,
          veneer.quantity,
          material.unit,
        ]
      );

      const savedItem = itemResult.rows[0];

      savedItems.push({
        id: savedItem.id,
        materialId: material.id,
        code: material.item_code,
        name: material.item_details,
        group: material.items_group,
        quantity: Number(
          savedItem.quantity
        ),
        unit: savedItem.unit,
      });

      /*
      |--------------------------------------------------------------
      | Insert STOCK OUT movement
      |--------------------------------------------------------------
      */

      await client.query(
        `
        INSERT INTO stock_movements (
          material_id,
          movement_type,
          quantity,
          movement_date,
          reference_no,
          remarks
        )
        VALUES (
          $1,
          'CONSUMPTION',
          $2,
          $3,
          $4,
          $5
        )
        `,
        [
          material.id,
          veneer.quantity,
          cleanDate,
          cleanOrderNo,
          `Consumption for Order ${cleanOrderNo}, Item ${cleanItemNo}`,
        ]
      );
    }

    /*
    |--------------------------------------------------------------------------
    | COMMIT
    |--------------------------------------------------------------------------
    */

    await client.query("COMMIT");

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    res.status(201).json({
      success: true,
      message:
        "Veneer consumption saved successfully.",
      consumption: {
        id: consumption.id,
        date: consumption.consumption_date,
        orderNo: consumption.order_no,
        itemNo: consumption.item_no,
        itemName: consumption.item_name,
        employeeName:
          consumption.employee_name,
        veneers: savedItems,
        createdAt:
          consumption.created_at,
      },
    });
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | ROLLBACK IF ANYTHING FAILED
    |--------------------------------------------------------------------------
    */

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Rollback failed:",
        rollbackError
      );
    }

    console.error(
      "Create consumption error:",
      error
    );

    /*
    |--------------------------------------------------------------------------
    | DUPLICATE DATABASE CONSTRAINT
    |--------------------------------------------------------------------------
    */

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "This Order No. + Item No. combination already exists.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FOREIGN KEY ERROR
    |--------------------------------------------------------------------------
    */

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid material or related database record.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | OTHER ERROR
    |--------------------------------------------------------------------------
    */

    res.status(500).json({
      success: false,
      message:
        "Failed to save veneer consumption.",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/*
|--------------------------------------------------------------------------
| STOCK SUMMARY
|--------------------------------------------------------------------------
|
| Calculates live stock from stock_movements.
|
| Current Stock =
| OPENING + STOCK_IN - CONSUMPTION
|
*/

app.get("/api/stock", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id AS material_id,
        m.item_code,
        m.item_details,
        m.items_group,
        m.unit,

        COALESCE(
          SUM(
            CASE
              WHEN sm.movement_type = 'OPENING'
              THEN sm.quantity
              ELSE 0
            END
          ),
          0
        ) AS opening_stock,

        COALESCE(
          SUM(
            CASE
              WHEN sm.movement_type = 'STOCK_IN'
              THEN sm.quantity
              ELSE 0
            END
          ),
          0
        ) AS stock_in,

        COALESCE(
          SUM(
            CASE
              WHEN sm.movement_type = 'CONSUMPTION'
              THEN sm.quantity
              ELSE 0
            END
          ),
          0
        ) AS consumption

      FROM materials m

      LEFT JOIN stock_movements sm
        ON sm.material_id = m.id

      GROUP BY
        m.id,
        m.item_code,
        m.item_details,
        m.items_group,
        m.unit

      ORDER BY m.item_code
    `);

    const stock = result.rows.map((row) => {
      const openingStock =
        Number(row.opening_stock);

      const stockIn =
        Number(row.stock_in);

      const consumption =
        Number(row.consumption);

      const currentStock =
        openingStock +
        stockIn -
        consumption;

      return {
        materialId: row.material_id,

        code: row.item_code,

        name: row.item_details,

        group: row.items_group,

        unit: row.unit,

        openingStock,

        stockIn,

        consumption,

        currentStock,
      };
    });

    res.json({
      success: true,
      stock,
    });
  } catch (error) {
    console.error(
      "Failed to fetch stock:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch stock",
      error: error.message,
    });
  }
});

app.post("/api/stock/opening", async (req, res) => {
  const { materialId, quantity, date, remarks } = req.body;

  try {
    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Material is required",
      });
    }

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    const materialCheck = await pool.query(
      `
      SELECT id, item_code, item_details, unit
      FROM materials
      WHERE id = $1
      `,
      [materialId]
    );

    if (materialCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO stock_movements (
        material_id,
        movement_type,
        quantity,
        movement_date,
        reference_no,
        remarks
      )
      VALUES (
  $1,
  'OPENING',
  $2,
  $3,
  'OPENING-STOCK',
  $4
)
      RETURNING *
      `,
      [
  materialId,
  Number(quantity),
  date || new Date().toISOString().slice(0, 10),
  remarks || null,
]
    );

    res.status(201).json({
      success: true,
      message: "Opening stock added successfully",
      movement: result.rows[0],
      material: materialCheck.rows[0],
    });
  } catch (error) {
    console.error(
      "Failed to add opening stock:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to add opening stock",
      error: error.message,
    });
  }
});

app.post("/api/stock/in", async (req, res) => {
  const {
    materialId,
    quantity,
    date,
    referenceNo,
    remarks,
  } = req.body;

  try {
    if (!materialId) {
      return res.status(400).json({
        success: false,
        message: "Material is required",
      });
    }

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Stock In date is required",
      });
    }

    const materialCheck = await pool.query(
      `
      SELECT id, item_code, item_details, unit
      FROM materials
      WHERE id = $1
      `,
      [materialId]
    );

    if (materialCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO stock_movements (
        material_id,
        movement_type,
        quantity,
        movement_date,
        reference_no,
        remarks
      )
      VALUES (
        $1,
        'STOCK_IN',
        $2,
        $3,
        $4,
        $5
      )
      RETURNING *
      `,
      [
        materialId,
        Number(quantity),
        date,
        referenceNo || null,
        remarks || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Stock In added successfully",
      movement: result.rows[0],
      material: materialCheck.rows[0],
    });
  } catch (error) {
    console.error(
      "Failed to add stock in:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to add Stock In",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `Backend running at http://localhost:${PORT}`
  );
});