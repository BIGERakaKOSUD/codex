import Link from "next/link";
import { Calculator, TableProperties } from "lucide-react";
import { EconomicsDashboard } from "@/components/EconomicsDashboard";

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Calculator size={24} />
          <h1>Ozon Unit Economics</h1>
        </div>
        <nav className="nav">
          <Link href="/">
            <TableProperties size={16} />
            Калькулятор
          </Link>
          <Link href="/ozon-unit-economics">Ozon Unit Economics</Link>
          <Link href="/tariffs">Tariffs</Link>
        </nav>
      </header>
      <EconomicsDashboard />
    </main>
  );
}
