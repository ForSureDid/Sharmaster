export default function About() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">О нас</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Sharmaster — оптовый магазин воздушных шаров в Казахстане. Мы работаем с организаторами
        праздников, декораторами, магазинами и частными покупателями.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        В нашем ассортименте более 10000 наименований товаров: латексные и фольгированные шары,
        гелий, оборудование и аксессуары для оформления. Гарантируем качество и доступные оптовые цены.
      </p>
      <a
        href="https://wa.me/77769510282"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium rounded-xl transition-colors"
      >
        Связаться с нами
      </a>
    </div>
  );
}
