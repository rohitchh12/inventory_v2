import React, { useEffect, useState } from "react";

const MATERIALS_API_URL =
  "http://localhost:5000/api/materials";

const CONSUMPTIONS_API_URL =
  "http://localhost:5000/api/consumptions";

function getToday() {
  const today = new Date();

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

export default function Veneer() {
  const [date, setDate] = useState(getToday());

  const [orderNo, setOrderNo] = useState("");
  const [itemNo, setItemNo] = useState("");
  const [itemName, setItemName] = useState("");
  const [employeeName, setEmployeeName] =
    useState("");

  const [selectedVeneerCode, setSelectedVeneerCode] =
    useState("");
    const [materialSearch, setMaterialSearch] = useState("");
const [showMaterialResults, setShowMaterialResults] =
  useState(false);

  const [quantity, setQuantity] = useState("");

  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] =
    useState(true);

  const [addedVeneers, setAddedVeneers] =
    useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | LOAD MATERIALS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    async function loadMaterials() {
      try {
        setLoadingMaterials(true);
        setError("");

        const response = await fetch(
          MATERIALS_API_URL
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! Status: ${response.status}`
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.message ||
              "Materials API returned success=false."
          );
        }

        if (!Array.isArray(data.materials)) {
          throw new Error(
            "Materials API did not return a materials array."
          );
        }

        setMaterials(data.materials);
      } catch (fetchError) {
        console.error(
          "Failed to load materials:",
          fetchError
        );

        setError(
          `Unable to load materials: ${fetchError.message}`
        );

        setMaterials([]);
      } finally {
        setLoadingMaterials(false);
      }
    }

    loadMaterials();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | SELECTED MATERIAL
  |--------------------------------------------------------------------------
  */

  const selectedMaterial = materials.find(
    (material) =>
      String(material.id) ===
      String(selectedVeneerCode)
  );

  const filteredMaterials = materials.filter((material) => {
  const search = materialSearch.toLowerCase().trim();

  if (!search) return true;

  return (
    material.item_code
      .toLowerCase()
      .includes(search) ||
    material.item_details
      .toLowerCase()
      .includes(search)
  );
});

  /*
  |--------------------------------------------------------------------------
  | ADD VENEER TO CURRENT CONSUMPTION
  |--------------------------------------------------------------------------
  */

  function handleAddVeneer() {
    setError("");
    setMessage("");

    if (!selectedVeneerCode) {
      setError("Please select a veneer.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (
      !quantity ||
      Number.isNaN(numericQuantity) ||
      numericQuantity <= 0
    ) {
      setError(
        "Please enter a quantity greater than 0."
      );
      return;
    }

    if (!selectedMaterial) {
      setError(
        "Selected material was not found."
      );
      return;
    }

    setAddedVeneers((current) => [
      ...current,
      {
        id: createId(),

        materialId: selectedMaterial.id,
        code: selectedMaterial.item_code,
        name: selectedMaterial.item_details,
        group: selectedMaterial.items_group,
        unit: selectedMaterial.unit,

        quantity: numericQuantity,
      },
    ]);

    setSelectedVeneerCode("");
setMaterialSearch("");
setShowMaterialResults(false);
setQuantity("");
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE VENEER
  |--------------------------------------------------------------------------
  */

  function handleDeleteVeneer(id) {
    setAddedVeneers((current) =>
      current.filter(
        (veneer) => veneer.id !== id
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SAVE CONSUMPTION TO POSTGRESQL
  |--------------------------------------------------------------------------
  */

  async function handleSave() {
    setError("");
    setMessage("");

    const cleanOrderNo = orderNo.trim();
    const cleanItemNo = itemNo.trim();
    const cleanItemName = itemName.trim();
    const cleanEmployeeName =
      employeeName.trim();

    /*
    |--------------------------------------------------------------------------
    | VALIDATION
    |--------------------------------------------------------------------------
    */

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (!cleanOrderNo) {
      setError("Please enter Order No.");
      return;
    }

    if (!cleanItemNo) {
      setError("Please enter Item No.");
      return;
    }

    if (!cleanItemName) {
      setError("Please enter Item Name.");
      return;
    }

    if (!cleanEmployeeName) {
      setError("Please enter Employee Name.");
      return;
    }

    if (addedVeneers.length === 0) {
      setError(
        "Please add at least one material."
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | PREPARE DATA
    |--------------------------------------------------------------------------
    */

    const payload = {
      date,
      orderNo: cleanOrderNo,
      itemNo: cleanItemNo,
      itemName: cleanItemName,
      employeeName: cleanEmployeeName,

      veneers: addedVeneers.map((veneer) => ({
        materialId: veneer.materialId,
        quantity: veneer.quantity,
      })),
    };

    try {
      setSaving(true);

      const response = await fetch(
        CONSUMPTIONS_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

            if (!response.ok || !data.success) {
  if (response.status === 409 && data.duplicate) {
    const confirmSubmit = window.confirm(
      `${data.message}\n\nDo you want to submit it again?`
    );

    if (!confirmSubmit) {
      return;
    }

    // User confirmed duplicate.
    // Send the request again with forceDuplicate = true.
    const retryPayload = {
      ...payload,
      forceDuplicate: true,
    };

    const retryResponse = await fetch(
      CONSUMPTIONS_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retryPayload),
      }
    );

    const retryData =
      await retryResponse.json();

    if (!retryResponse.ok || !retryData.success) {
      throw new Error(
        retryData.message ||
          `Failed to save consumption. HTTP ${retryResponse.status}`
      );
    }
  } else {
    throw new Error(
      data.message ||
        `Failed to save consumption. HTTP ${response.status}`
    );
  }
}

      /*
      |--------------------------------------------------------------------------
      | SUCCESS
      |--------------------------------------------------------------------------
      */

      setMessage(
        "Material consumption saved successfully."
      );

      /*
      | Tell Consumption.jsx to reload data.
      */

      window.dispatchEvent(
        new Event("MaterialConsumptionUpdated")
      );

      /*
      | Reset form.
      */

      setDate(getToday());
      setOrderNo("");
      setItemNo("");
      setItemName("");
      setEmployeeName("");
      setSelectedVeneerCode("");
      setQuantity("");
      setAddedVeneers([]);
    } catch (saveError) {
      console.error(
        "Failed to save consumption:",
        saveError
      );

      setError(
        saveError.message ||
          "Failed to save consumption."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | TAILWIND CLASSES
  |--------------------------------------------------------------------------
  */

  const inputClass =
    "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const labelClass =
    "text-xs font-semibold uppercase tracking-wide text-slate-600";

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="text-sm font-medium text-slate-500">
            Material Consumption
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Material Consumption
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Record Material usage against an
            order and item.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <p className="text-xs text-slate-500">
            Storage
          </p>

          <p className="text-sm font-semibold text-emerald-600">
            PostgreSQL
          </p>
        </div>

      </div>

      {/* ORDER DETAILS */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h3 className="text-sm font-semibold text-slate-900">
            Order Details
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Enter the basic information for
            this consumption entry.
          </p>

        </div>

        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">

          {/* DATE */}

          <div>
            <label className={labelClass}>
              Date
            </label>

            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              className={inputClass}
            />
          </div>

          {/* ORDER NO */}

          <div>
            <label className={labelClass}>
              Order No.
            </label>

            <input
              type="text"
              value={orderNo}
              onChange={(event) =>
                setOrderNo(event.target.value)
              }
              placeholder="Enter order number"
              className={inputClass}
            />
          </div>

          {/* ITEM NO */}

          <div>
            <label className={labelClass}>
              Item No.
            </label>

            <input
              type="text"
              value={itemNo}
              onChange={(event) =>
                setItemNo(event.target.value)
              }
              placeholder="Enter item number"
              className={inputClass}
            />
          </div>

          {/* ITEM NAME */}

          <div>
            <label className={labelClass}>
              Item Name
            </label>

            <input
              type="text"
              value={itemName}
              onChange={(event) =>
                setItemName(event.target.value)
              }
              placeholder="Enter item name"
              className={inputClass}
            />
          </div>

          {/* EMPLOYEE NAME */}

          <div>
            <label className={labelClass}>
              Employee Name
            </label>

            <input
              type="text"
              value={employeeName}
              onChange={(event) =>
                setEmployeeName(event.target.value)
              }
              placeholder="Enter employee name"
              className={inputClass}
            />
          </div>

        </div>
      </section>

      {/* ADD VENEER */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <div className="flex items-center justify-between">

            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Add Material
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Select a Material and enter the
                consumed quantity.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {addedVeneers.length} added
            </span>

          </div>

        </div>

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_180px_auto] lg:items-end">

          {/* MATERIAL */}

          <div>
            <label className={labelClass}>
              Material
            </label>

           <div className="relative">
  <input
    type="text"
    value={materialSearch}
    onChange={(event) => {
      setMaterialSearch(event.target.value);
      setShowMaterialResults(true);
      setSelectedVeneerCode("");
    }}
    onFocus={() => setShowMaterialResults(true)}
    placeholder={
      loadingMaterials
        ? "Loading materials..."
        : "Search Wood by code or name..."
    }
    disabled={loadingMaterials}
    className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100`}
  />

  {showMaterialResults && !loadingMaterials && (
    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

      {filteredMaterials.length === 0 ? (
        <div className="px-3 py-3 text-sm text-slate-500">
          No matching Wood found.
        </div>
      ) : (
        filteredMaterials.map((material) => (
          <button
            key={material.id}
            type="button"
            onClick={() => {
              setSelectedVeneerCode(
                String(material.id)
              );
              setMaterialSearch(
                `${material.item_code} - ${material.item_details}`
              );
              setShowMaterialResults(false);
            }}
            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100"
          >
            <span className="font-medium text-slate-900">
              {material.item_code}
            </span>

            <span className="text-slate-600">
              {" - "}
              {material.item_details}
            </span>
          </button>
        ))
      )}

    </div>
  )}
</div>
          </div>

          {/* QUANTITY */}

          <div>
            <label className={labelClass}>
              Quantity
            </label>

            <div className="relative">

              <input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target.value
                  )
                }
                placeholder="0.00"
                className={`${inputClass} pr-16`}
              />

              {selectedMaterial && (
                <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-medium text-slate-400">
                  {selectedMaterial.unit}
                </span>
              )}

            </div>
          </div>

          {/* ADD BUTTON */}

          <button
            type="button"
            onClick={handleAddVeneer}
            disabled={
              loadingMaterials || saving
            }
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add 
          </button>

        </div>

      </section>

      {/* ADDED VENEERS */}

      {addedVeneers.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-5 py-4">

            <h3 className="text-sm font-semibold text-slate-900">
              Materials Added
            </h3>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full text-left text-sm">

              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">

                <tr>

                  <th className="px-5 py-3 font-semibold">
                    S.No.
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Material Code
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Material Name
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Quantity
                  </th>

                  <th className="px-5 py-3 font-semibold">
                    Unit
                  </th>

                  <th className="px-5 py-3 text-right font-semibold">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {addedVeneers.map(
                  (veneer, index) => (
                    <tr
                      key={veneer.id}
                      className="transition hover:bg-slate-50"
                    >

                      <td className="px-5 py-4 font-medium text-slate-500">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">

                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                          {veneer.code}
                        </span>

                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800">
                        {veneer.name}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {veneer.quantity}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {veneer.unit}
                      </td>

                      <td className="px-5 py-4 text-right">

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteVeneer(
                              veneer.id
                            )
                          }
                          disabled={saving}
                          className="text-sm font-medium text-red-600 transition hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>
      )}

      {/* ERROR */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* SAVE */}

      <div className="flex justify-end">

        <button
          type="button"
          onClick={handleSave}
          disabled={
            saving || loadingMaterials
          }
          className="rounded-lg bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Consumption"}
        </button>

      </div>

    </div>
  );
}