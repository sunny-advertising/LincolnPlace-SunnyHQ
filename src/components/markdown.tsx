import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders staff-written Markdown. Raw HTML is not rendered (react-markdown escapes it). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{children}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
