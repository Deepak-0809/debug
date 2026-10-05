import LegalLayout, { Section } from "@/components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <Section title="Overview">
        <p>
          This policy explains what data Debug collects when you use the app, why, who it is shared with, and how long it is kept.
          We only collect what is needed to run the service. We do not sell your data and we do not show ads.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li><strong>Account details:</strong> email address, name, username, profile picture (if you sign in with Google), and sign-in method. Passwords are stored only in hashed form by our authentication provider.</li>
          <li><strong>Debug runs:</strong> the code you paste (buggy and reference), the problem details, detected language, generated test cases, program outputs, and the AI diagnosis.</li>
          <li><strong>Assistant chat messages:</strong> messages you send to the Debug Assistant on a run and its replies, saved so you can reopen the conversation from your history.</li>
          <li><strong>Usage and plan records:</strong> your plan, how many searches and single tests you have used, and a log of plan changes.</li>
          <li><strong>Payment records:</strong> plan bought, amount, currency, date, validity period and Razorpay order/payment references. We never see or store your card, UPI or bank details — those are handled by Razorpay.</li>
          <li><strong>Technical records:</strong> request counts used for rate limiting and a log of AI requests (which feature, which AI provider answered, success or failure). The AI log does not contain your code.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To run the debugging pipeline: analyse your problem, compile and run your code, generate test cases and explain the bug.</li>
          <li>To show your run history and chat history.</li>
          <li>To enforce plan limits, process payments and prevent abuse.</li>
        </ul>
        <p>Debug does not train AI models on your code. Third-party AI services process submissions under their own terms and privacy policies; their retention and model-improvement practices depend on the provider and account settings. Do not submit confidential code or personal information.</p>
      </Section>

      <Section title="Who we share data with">
        <p>To provide the service, some data is sent to these processors:</p>
        <ul>
          <li><strong>Lovable Cloud</strong> — hosts the app, database and sign-in.</li>
          <li><strong>AI providers</strong> — your code, problem details and chat messages are sent to an AI model to analyse them. Free users are served by Lovable's AI gateway (Google Gemini models); paid users may be served by Google Gemini or OpenAI, with Lovable's AI as a fallback.</li>
          <li><strong>Judge0</strong> (including via RapidAPI) — your code and test inputs are sent there to be compiled and executed.</li>
          <li><strong>Razorpay</strong> — processes payments.</li>
          <li><strong>Google</strong> — only if you choose "Sign in with Google".</li>
        </ul>
        <p>Each of these services handles data under its own privacy policy. We may also disclose data if required by law.</p>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li><strong>Debug runs, test cases and assistant chat messages:</strong> a daily cleanup deletes runs older than 90 days, measured from when the run was created. Their test cases and chat messages are deleted together with the run. Deletion happens at the next daily cleanup after the 90-day period.</li>
          <li><strong>Account and profile:</strong> kept while your account exists.</li>
          <li><strong>Payment records:</strong> kept for as long as needed for accounting, tax and dispute purposes, even after an account is closed.</li>
          <li><strong>Plan, usage and AI request logs, rate-limit records:</strong> kept while your account exists, for billing accuracy and abuse prevention, and deleted when your account is deleted.</li>
        </ul>
        <p>This retention period covers Debug's app database. Hosting backups and third-party services may retain copies under their own retention policies; deleting a run in Debug does not guarantee immediate deletion from those systems.</p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We use your browser's local storage to keep you signed in and remember your theme. We do not use advertising or third-party tracking cookies.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is sent over HTTPS. Database access rules ensure you can only read your own runs, chats and payments. No system is perfectly secure, but we take reasonable steps to protect your data.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can view your runs and payments in the app. You can ask us to access, correct, or delete your account and its data by emailing{" "}
          <a href="mailto:founders@debugcp.me" className="text-primary hover:underline">founders@debugcp.me</a>. We respond within 30 days. Account deletion is handled by our team, not automatically by sending an email, and we may need to verify that you own the account. Deleting your account removes your profile, runs, test cases, chat messages, plan records, usage logs, AI request logs and rate-limit records; payment records may be retained as described above.
        </p>
      </Section>

      <Section title="Children">
        <p>The service is not intended for children under 13.</p>
      </Section>

      <Section title="Changes">
        <p>If we change this policy, we will update the date at the top of this page.</p>
      </Section>
    </LegalLayout>
  );
}
