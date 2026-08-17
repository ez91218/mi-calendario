document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const errorEl = document.getElementById('login-error');

    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.style.display = 'none';

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (res.ok) {
                    window.location.href = '/';
                } else {
                    errorEl.style.display = 'block';
                }
            } catch (err) {
                console.error('Error al intentar iniciar sesión:', err);
                errorEl.textContent = 'Error de conexión con el servidor.';
                errorEl.style.display = 'block';
            }
        });
    }
});