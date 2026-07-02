import About from "@/components/About";
import ReviewForm from "@/components/ReviewForm";

export default function AboutReviews() {
  return (
    <section id="about" className="py-12 bg-gray-50 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <About />
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Оставьте отзыв</h2>
            <ReviewForm />
          </div>
        </div>
      </div>
    </section>
  );
}
