import React from 'react'
import clsx from 'clsx'

const variantClasses = {
    default:
        'bg-[#003399] border border-gray-300 text-white hover:bg-[#002680] hover:shadow',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-100',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    destructive: 'bg-[#FF4500] text-white hover:bg-[#FF5500]',
}

export function Button({ children, variant = 'default', className, ...props }) {
    return (
        <button
            {...props}
            className={clsx(
                'inline-flex items-center gap-3 rounded-md px-3 py-2 text-sm focus:outline-none',
                variantClasses[variant],
                className
            )}
        >
            {children}
        </button>
    )
}
