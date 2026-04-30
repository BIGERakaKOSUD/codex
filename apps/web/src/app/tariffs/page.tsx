import Link from "next/link";
import { Calculator } from "lucide-react";
import { TariffsManager } from "@/components/TariffsManager";

export default function TariffsPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Calculator size={24} />
          <h1>Tariffs</h1>
        </div>
        <nav className="nav">
          <Link href="/">Калькулятор</Link>
          <Link href="/tariffs">Tariffs</Link>
        </nav>
      </header>
      <TariffsManager />
    </main>
  );
}
