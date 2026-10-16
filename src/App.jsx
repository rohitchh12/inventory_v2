import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";

import Veneer from "./components/veneer.jsx";
import Consumption from "./components/consumption.jsx";
import Stock from "./components/Stock.jsx";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            
            {/* Company / App Title */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Tarun Vadehra Interiors Pvt. Ltd.
              </h1>

              <p className="text-3xl font-bold text-slate-900">
                Material Management
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                Inventory & Consumption
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              
              <NavLink
                to="/veneer"
                className={({ isActive }) =>
                  `rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                Entry
              </NavLink>

              <NavLink
                to="/consumption"
                className={({ isActive }) =>
                  `rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                Consumption List
              </NavLink>

              <NavLink
                to="/stock"
                className={({ isActive }) =>
                  `rounded-md px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`
                }
              >
                Stock
              </NavLink>

            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            
            {/* Veneer Master */}
            <Route
              path="/veneer"
              element={<Veneer />}
            />

            {/* Consumption */}
            <Route
              path="/consumption"
              element={<Consumption />}
            />

            {/* Stock */}
            <Route
              path="/stock"
              element={<Stock />}
            />

            {/* Default Route */}
            <Route
              path="/"
              element={<Navigate to="/veneer" replace />}
            />

            {/* Unknown Routes */}
            <Route
              path="*"
              element={<Navigate to="/veneer" replace />}
            />

          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;