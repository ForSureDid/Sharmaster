import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Image src="/logo.png" alt="Sharmaster" width={120} height={36} className="h-8 w-auto brightness-0 invert opacity-70" />
        <p className="text-sm">© 2024 Sharmaster.kz — Оптовый магазин воздушных шаров</p>
        <div className="flex gap-4 text-sm">
          <a href="https://wa.me/77769370282" className="hover:text-white transition-colors">WhatsApp</a>
          <a href="https://instagram.com/sharmaster.kz" className="hover:text-white transition-colors">Instagram</a>
        </div>
      </div>
    </footer>
  );
}
