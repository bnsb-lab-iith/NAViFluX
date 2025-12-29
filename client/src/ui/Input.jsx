import React from "react";

export function Input({ className, ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border font-semibold border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
    />
  );
}
