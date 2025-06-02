export default function AskQuestion({ tag, question }) {
  return (
    <div className="w-full my-2 h-full">
          <div className="h-full rounded-lg shadow-md bg-white transition-all duration-300 pr-3 flex items-stretch gap-2">
              <span className="text-lg font-semibold text-gray-800 bg-slate-900 rounded-l-lg text-white py-2 px-3 h-auto flex items-center">
                {tag}:
              </span>
              <span className="my-auto">
                {question}
              </span>
          </div>
    </div>
  );
}
