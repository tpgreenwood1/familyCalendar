export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-600">
      Family Calendar · {new Date().getFullYear()}
    </footer>
  );
}
