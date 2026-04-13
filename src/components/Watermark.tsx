const Watermark = () => (
  <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none select-none">
    <div className="text-center opacity-[0.06] text-foreground">
      <p className="text-5xl sm:text-6xl md:text-7xl font-display font-bold leading-tight">Sudhanshu</p>
      <p className="text-5xl sm:text-6xl md:text-7xl font-display font-bold leading-tight">Jumade</p>
    </div>
  </div>
);

export default Watermark;
