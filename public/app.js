const form = document.getElementById('mailerForm');
const result = document.getElementById('result');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  result.textContent = 'Sending emails... this can take time due to anti-spam delays.';

  try {
    const recruiterEmails = document.getElementById('recruiterEmails').value;

    const response = await fetch('/send-mails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recruiterEmails }),
    });

    const payload = await response.json();

    if (!response.ok) {
      result.textContent = `Error: ${payload.error}\n${payload.detail || ''}`;
      return;
    }

    result.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    result.textContent = `Request failed: ${error.message}`;
  } finally {
    submit.disabled = false;
  }
});
