/**
 * AndritzLogo — renders the official Andritz PNG wordmark.
 * Use the `white` prop to apply a CSS filter that turns the blue logo white
 * (for use on the dark sidebar / login panel).
 */
export default function AndritzLogo({ white = false, className = '', style = {} }) {
  return (
    <img
      src="/andritz-logo.png"
      alt="Andritz"
      className={className}
      style={{ ...(white ? { filter: 'brightness(0) invert(1)' } : {}), ...style }}
      draggable={false}
    />
  )
}
