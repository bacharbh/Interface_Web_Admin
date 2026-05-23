import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const variantMap: Record<Variant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
    secondary: 'bg-white dark:bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-primary)] hover:border-[#c7ddd3]',
    ghost: 'bg-transparent text-primary hover:bg-primary/5',
    danger: 'bg-red-500 text-white hover:bg-red-600'
};

const sizeMap: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className = '', children, ...rest }) => {
    const variantClass = variantMap[variant] || variantMap.primary;
    const sizeClass = sizeMap[size] || sizeMap.md;

    return (
        <button
            {...rest}
            className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors ${variantClass} ${sizeClass} ${className}`}
        >
            {children}
        </button>
    );
};

export default Button;
