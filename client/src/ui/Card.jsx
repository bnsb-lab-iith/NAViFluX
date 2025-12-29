import React from "react";

export function Card({ children, className }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div className={`px-4 pt-3  ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h2 className={`text-sm font-semibold leading-6 text-gray-900 ${className}`}>
      {children}
    </h2>
  );
}

export function CardContent({ children, className }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
