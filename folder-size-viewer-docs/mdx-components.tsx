import { getMDXComponents } from '@/components/mdx';

export function useMDXComponents(components?: import('mdx/types').MDXComponents) {
  return getMDXComponents(components);
}
