export default function SectionHeading({ kicker, title, text, tone = 'light', children, id }) {
  const dark = tone === 'dark'
  return (
    <div className="reveal mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10" data-reveal>
      <div className="max-w-2xl">
        <p className={`flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide ${dark ? 'text-brand' : 'text-brand'}`}>
          <span className="inline-block h-[3px] w-7 rounded-full bg-brand" aria-hidden="true" />
          {kicker}
        </p>
        <h2 id={id} className={`mt-2 text-3xl font-black leading-tight sm:text-[2.6rem] ${dark ? 'text-white' : 'text-ink'}`}>
          {title}
        </h2>
        {text && <p className={`mt-3 text-lg ${dark ? 'text-white/70' : 'text-muted'}`}>{text}</p>}
      </div>
      {children}
    </div>
  )
}
