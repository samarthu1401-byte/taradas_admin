export default function Unauthorized() {
  return (
    <main className="login-page">
      <section className="login-card" style={{ padding: 40, textAlign: 'center' }}>
        <h1>Access restricted</h1>
        <p className="text-muted" style={{ marginTop: 12 }}>
          This account does not have administrator access.
        </p>
      </section>
    </main>
  );
}
