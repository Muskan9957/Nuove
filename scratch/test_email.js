require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const to = 'ashwinavinav7@gmail.com'; // Try sending to one of the test accounts
  console.log(`Attempting to send test email...`);
  console.log(`FROM: ${from}`);
  console.log(`TO: ${to}`);
  
  try {
    const response = await resend.emails.send({
      from,
      to,
      subject: 'Test Email from Nuove',
      html: '<p>If you get this, Resend is working!</p>'
    });
    
    console.log('Resend Response:', JSON.stringify(response, null, 2));
    
    if (response.error) {
      console.log('RESEND RETURNED AN ERROR:', response.error.message);
    }
  } catch (err) {
    console.error('THROWN ERROR:', err);
  }
}

main();
