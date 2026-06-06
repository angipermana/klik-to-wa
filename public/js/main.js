document.getElementById('leadForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const product = document.getElementById('product').value;
  
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnLoader = document.getElementById('btnLoader');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');

  // Basic client-side validation
  if (!name || !email || !phone || !product) {
    showError('Silakan lengkapi semua data.');
    return;
  }

  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
  btnText.textContent = 'Memproses...';
  btnLoader.style.display = 'inline-block';
  errorBox.classList.add('hidden');

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        product: product
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Redirect to WhatsApp
      window.open(data.redirectUrl, '_blank');
      
      // Reset form
      this.reset();
      
      // We can also show a success message or redirect to a thank you page
      // Here we just keep the button saying "Selesai"
      btnText.textContent = 'Membuka WhatsApp...';
      
      setTimeout(() => {
        resetBtnState();
      }, 3000);
    } else {
      showError(data.error || 'Terjadi kesalahan pada sistem.');
      resetBtnState();
    }
  } catch (error) {
    console.error('Error submitting form:', error);
    showError('Koneksi terputus. Silakan coba lagi.');
    resetBtnState();
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
    // scroll to top slightly
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function resetBtnState() {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
    btnText.textContent = 'Hubungi Lewat WhatsApp';
    btnLoader.style.display = 'none';
  }
});
