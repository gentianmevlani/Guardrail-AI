import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number | undefined;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-6xl font-bold text-white">{statusCode || 'Error'}</h1>
        <h2 className="text-2xl text-zinc-400">
          {statusCode === 404
            ? 'Page Not Found'
            : statusCode === 500
              ? 'Server Error'
              : 'An error occurred'}
        </h2>
        <p className="text-zinc-500 max-w-md mx-auto">
          {statusCode === 404
            ? "The page you're looking for doesn't exist or has been moved."
            : 'Something went wrong. Please try again.'}
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
