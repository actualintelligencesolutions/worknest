import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ElementType,
  ReactNode,
} from 'react';
import './style.scss';

type ButtonProps = (
  | ButtonHTMLAttributes<HTMLButtonElement>
  | AnchorHTMLAttributes<HTMLAnchorElement>
) & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  as?: ElementType;
};

export function Button({
  children,
  variant = 'primary',
  as: Component = 'button',
  ...props
}: ButtonProps) {
  return (
    <Component className={`button button-${variant}`} {...props}>
      {children}
    </Component>
  );
}
