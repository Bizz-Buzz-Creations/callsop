import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Tooltip } from "react-tooltip";

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);


  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight ? Math.round((scrollTop / docHeight) * 100) : 0;

      setScrollPercent(percent);
      setIsVisible(scrollTop > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const start = window.scrollY;
    const duration = 400;
    const startTime = performance.now();

    const animateScroll = (currentTime) => {
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      window.scrollTo(0, start * (1 - easeInOutCubic(progress)));

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    requestAnimationFrame(animateScroll);

  };

  const radius = 18;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (scrollPercent / 100) * circumference;

  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-2 transition-all duration-500 ease-in-out 
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'}
      `}
    >

      {/* <span className="bg-indigo-700 text-white px-3 py-1 rounded shadow text-sm animate-fade-in-up">
        {scrollPercent}% Back to Top
      </span> */}

      <button
        data-tooltip-id="backToTop"
        data-tooltip-content="Back to Top"
        onClick={scrollToTop}
        className="relative w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center group"
        title="Scroll to Top"
      >
        {/* Progress Circle */}
        <svg className="absolute top-0 left-0 w-full h-full rotate-[-90deg]" width="100%" height="100%">
          <circle
            stroke="#e5e7eb"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="50%"
            cy="50%"
          />
          <circle
            stroke="#4f46e5"
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx="50%"
            cy="50%"
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        </svg>

        {/* Arrow Icon */}
        <ArrowUp className="text-indigo-600 z-10 w-5 h-5" />
      </button>

      {/* <button
        data-tooltip-id="backToTop"
        data-tooltip-content="Back to Top"
        onClick={scrollToTop}
        className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg"
        title="Go to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button> */}

      <Tooltip id="backToTop" place="top" effect="solid" className="!bg-indigo-500 !font-semibold" />
    </div>
  );
};

export default ScrollToTopButton;
