import { useEffect, useState } from "react";

const STOCK_API_URL = "http://localhost:5000/api/stock";
const OPENING_STOCK_API_URL =
  "http://localhost:5000/api/stock/opening";
  const STOCK_IN_API_URL =
  "http://localhost:5000/api/stock/in";

function Stock() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedMaterial, setSelectedMaterial] =
    useState("");
    const [stockSearch, setStockSearch] = useState("");
const [showStockResults, setShowStockResults] =
  useState(false);

  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openingDate, setOpeningDate] =
  useState("");
const [stockInDate, setStockInDate] =
  useState("");
const [stockInQuantity, setStockInQuantity] =
  useState("");
const [stockInReference, setStockInReference] =
  useState("");
const [stockInRemarks, setStockInRemarks] =
  useState("");

  const loadStock = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(STOCK_API_URL);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load stock"
        );
      }

      setStock(data.stock || []);
    } catch (err) {
      console.error("Failed to load stock:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const handleOpeningStock = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!selectedMaterial) {
      setError("Please select a material.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setError("Please enter a quantity greater than 0.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        OPENING_STOCK_API_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
  materialId: Number(selectedMaterial),
  quantity: Number(quantity),
  date: openingDate,
  remarks: remarks.trim(),
}),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to add opening stock"
        );
      }

      setMessage(
        `Opening stock added successfully for ${data.material.item_code}.`
      );

      setQuantity("");
      setRemarks("");

      await loadStock();
    } catch (err) {
      console.error(
        "Failed to add opening stock:",
        err
      );

      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStockIn = async () => {
  setMessage("");
  setError("");

  if (!selectedMaterial) {
    setError("Please select a Wood.");
    return;
  }

  if (!stockInQuantity || Number(stockInQuantity) <= 0) {
    setError("Please enter a valid Stock In quantity.");
    return;
  }

  if (!stockInDate) {
    setError("Please select the Stock In date.");
    return;
  }

  setSaving(true);

  try {
    const response = await fetch(
      STOCK_IN_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          materialId: Number(selectedMaterial),
          quantity: Number(stockInQuantity),
          date: stockInDate,
          referenceNo: stockInReference.trim(),
          remarks: stockInRemarks.trim(),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          `Failed to add Stock In. HTTP ${response.status}`
      );
    }

    setMessage("Stock In added successfully.");

    setStockInQuantity("");
    setStockInDate("");
    setStockInReference("");
    setStockInRemarks("");

    await loadStock();
  } catch (error) {
    console.error("Stock In error:", error);
    setError(error.message);
  } finally {
    setSaving(false);
  }
};

  useEffect(() => {
    const handleConsumptionUpdate = () => {
      loadStock();
    };

    window.addEventListener(
      "veneerConsumptionUpdated",
      handleConsumptionUpdate
    );

    return () => {
      window.removeEventListener(
        "veneerConsumptionUpdated",
        handleConsumptionUpdate
      );
    };
  }, []);

  /*
   * Find the currently selected veneer.
   */
  const selectedStock = stock.find(
    (item) =>
      String(item.materialId) ===
      String(selectedMaterial)
  );

  const filteredStock = stock.filter((item) => {
  const search = stockSearch.toLowerCase().trim();

  if (!search) return true;

  return (
    item.code.toLowerCase().includes(search) ||
    item.name.toLowerCase().includes(search)
  );
});

  /*
   * Selected item's values
   */
  const selectedOpening =
    selectedStock
      ? Number(selectedStock.openingStock || 0)
      : null;

  const selectedStockIn =
    selectedStock
      ? Number(selectedStock.stockIn || 0)
      : null;

  const selectedConsumption =
    selectedStock
      ? Number(selectedStock.consumption || 0)
      : null;

  const selectedCurrentStock =
    selectedStock
      ? Number(selectedStock.currentStock || 0)
      : null;

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Stock
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Select a material to view its stock position
          and manage inventory.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Item Selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Select Material
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Choose a specific Material to view its
            stock details.
          </p>
        </div>

        <div className="max-w-xl">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Material
          </label>

          <div className="relative">
  <input
    type="text"
    value={stockSearch}
    onChange={(e) => {
      setStockSearch(e.target.value);
      setShowStockResults(true);
      setSelectedMaterial("");
    }}
    onFocus={() => setShowStockResults(true)}
    placeholder={
      loading
        ? "Loading materials..."
        : "Search Material by code or name..."
    }
    disabled={loading}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
  />

  {showStockResults && !loading && (
    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">

      {filteredStock.length === 0 ? (
        <div className="px-3 py-3 text-sm text-slate-500">
          No matching Wood found.
        </div>
      ) : (
        filteredStock.map((item) => (
          <button
            key={item.materialId}
            type="button"
            onClick={() => {
              setSelectedMaterial(
                String(item.materialId)
              );
              setStockSearch(
                `${item.code} — ${item.name}`
              );
              setShowStockResults(false);
              setMessage("");
              setError("");
            }}
            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-100"
          >
            <span className="font-medium text-slate-900">
              {item.code}
            </span>

            <span className="text-slate-600">
              {" — "}
              {item.name}
            </span>
          </button>
        ))
      )}

    </div>
  )}
</div>
        </div>

      </div>

      {/* Selected Item Information */}
      {selectedStock && (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Selected Material
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-lg font-bold text-slate-900">
              {selectedStock.code}
            </span>

            <span className="text-slate-400">
              |
            </span>

            <span className="text-lg text-slate-700">
              {selectedStock.name}
            </span>

            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {selectedStock.unit}
            </span>
          </div>

        </div>
      )}

      {/* Stock Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Opening Stock */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Opening Stock
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {selectedStock
              ? selectedOpening.toFixed(2)
              : "—"}
          </p>

          {selectedStock && (
            <p className="mt-1 text-xs text-slate-400">
              {selectedStock.unit}
            </p>
          )}
        </div>

        {/* Stock In */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Stock In
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {selectedStock
              ? selectedStockIn.toFixed(2)
              : "—"}
          </p>

          {selectedStock && (
            <p className="mt-1 text-xs text-slate-400">
              {selectedStock.unit}
            </p>
          )}
        </div>

        {/* Consumption */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Consumption
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {selectedStock
              ? selectedConsumption.toFixed(2)
              : "—"}
          </p>

          {selectedStock && (
            <p className="mt-1 text-xs text-slate-400">
              {selectedStock.unit}
            </p>
          )}
        </div>

        {/* Current Stock */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Current Stock
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              selectedStock &&
              selectedCurrentStock < 0
                ? "text-red-600"
                : "text-slate-900"
            }`}
          >
            {selectedStock
              ? selectedCurrentStock.toFixed(2)
              : "—"}
          </p>

          {selectedStock && (
            <p className="mt-1 text-xs text-slate-400">
              {selectedStock.unit}
            </p>
          )}
        </div>

      </div>

      {/* Opening Stock Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Add Opening Stock
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Add opening inventory for the selected
            Material.
          </p>
        </div>

        <form
          onSubmit={handleOpeningStock}
          className="grid gap-4 md:grid-cols-3"
        >

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Quantity
            </label>

            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
              placeholder={
                selectedStock
                  ? `Enter quantity in ${selectedStock.unit}`
                  : "Select a Material first"
              }
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <div>
  <label className="mb-1.5 block text-sm font-medium text-slate-700">
    Opening Stock Date
  </label>

  <input
    type="date"
    value={openingDate}
    onChange={(e) => setOpeningDate(e.target.value)}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
  />
</div>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Remarks
            </label>

            <input
              type="text"
              value={remarks}
              onChange={(e) =>
                setRemarks(e.target.value)
              }
              placeholder="Optional"
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {/* Button */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={
                saving || !selectedStock
              }
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Add Opening Stock"}
            </button>
          </div>

        </form>
      </div>
            

      {/* Stock In Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Add Stock In
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Add new material received into stock.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Quantity
            </label>

            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={stockInQuantity}
              onChange={(e) =>
                setStockInQuantity(e.target.value)
              }
              placeholder={
                selectedStock
                  ? `Enter quantity in ${selectedStock.unit}`
                  : "Select a Material first"
              }
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Stock In Date
            </label>

            <input
              type="date"
              value={stockInDate}
              onChange={(e) =>
                setStockInDate(e.target.value)
              }
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Reference No.
            </label>

            <input
              type="text"
              value={stockInReference}
              onChange={(e) =>
                setStockInReference(e.target.value)
              }
              placeholder="PO / Invoice / GRN"
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Remarks
            </label>

            <input
              type="text"
              value={stockInRemarks}
              onChange={(e) =>
                setStockInRemarks(e.target.value)
              }
              placeholder="Optional"
              disabled={!selectedStock}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={handleStockIn}
            disabled={saving || !selectedStock}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Stock In"}
          </button>
        </div>

      </div>

      {/* Stock Table */}

      {/* Stock Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">
            Current Stock
          </h3>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Loading stock...
          </div>
        ) : stock.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No materials found.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left">

                  <th className="px-4 py-3 font-semibold text-slate-600">
                    S.No.
                  </th>

                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Material Code
                  </th>

                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Material Name
                  </th>

                  <th className="px-4 py-3 font-semibold text-slate-600">
                    Unit
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Opening
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Stock In
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Consumption
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-600">
                    Current Stock
                  </th>

                </tr>
              </thead>

              <tbody>
                {stock.map((item, index) => {

                  const currentStock =
                    Number(
                      item.currentStock || 0
                    );

                  return (
                    <tr
                      key={item.materialId}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >

                      <td className="px-4 py-3 text-slate-500">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.code}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {item.name}
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {item.unit}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {Number(
                          item.openingStock || 0
                        ).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {Number(
                          item.stockIn || 0
                        ).toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {Number(
                          item.consumption || 0
                        ).toFixed(2)}
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          currentStock < 0
                            ? "text-red-600"
                            : "text-slate-900"
                        }`}
                      >
                        {currentStock.toFixed(2)}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}

export default Stock;