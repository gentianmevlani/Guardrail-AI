'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-4xl font-bold text-white">Something went wrong</h1>
            <p className="text-zinc-400 max-w-md">
              A critical error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
