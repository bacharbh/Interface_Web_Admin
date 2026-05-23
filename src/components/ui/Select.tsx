import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    className?: string;
}

const Select: React.FC<SelectProps> = ({ label, className = '', children, ...rest }) => {
    return (
        <div className={`flex flex-col ${className}`}>
            {label && <label className="label-sm text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <select
                {...rest}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#071422] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
                {children}
            </select>
        </div>
    );
};

export default Select;
