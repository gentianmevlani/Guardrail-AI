import CodeBlock from './CodeBlock';

const mdxComponents = {
  code: CodeBlock,
  // Add more custom MDX components here
  // pre: ({ children }) => <>{children}</>,
  // img: ({ src, alt, ...props }) => <Image src={src} alt={alt} {...props} />,
};

export default mdxComponents;
