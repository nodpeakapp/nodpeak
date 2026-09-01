export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
