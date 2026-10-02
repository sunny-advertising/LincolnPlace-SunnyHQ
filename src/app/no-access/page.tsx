export default function NoAccess() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="wm">Sunny<span>.</span> Client portal</div>
        <p>Your account doesn&apos;t have access to the portal yet. Ask your Sunny account lead to invite you.</p>
        <form action="/auth/signout" method="post">
          <button className="btn" type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}
