import { FormEvent, useMemo, useState } from 'react';
import {
  CheckCircle2,
  LifeBuoy,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import {
  createSupportTicket,
  deleteHelpcenterFeedback,
  submitHelpcenterFeedback,
  WHATSAPP_PROOF_DISPLAY,
  WHATSAPP_PROOF_NUMBER,
} from '../lib/mezoneDb';
import {
  FeedbackCategory,
  HelpcenterFeedbackRecord,
  SupportTicketRecord,
  SupportTopic,
  UserProfile,
} from '../types/mezone';

interface HelpcenterSectionProps {
  uid: string;
  userName: string;
  userEmail: string;
  isVerified: boolean;
  profile: UserProfile | null;
  myTickets: SupportTicketRecord[];
  feedbackList: HelpcenterFeedbackRecord[];
  onFlashStatus: (message: string) => void;
  onGoToVerificationCenter: () => void;
}

interface HelpArticle {
  id: string;
  topic: SupportTopic;
  question: string;
  answer: string;
}

const TOPICS: Array<'All Topics' | SupportTopic> = [
  'All Topics',
  'Shopping & Products',
  'Order Proof Verification',
  'Referral Program',
  'Wallet & Withdraw',
  'Account Verification',
];

const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Shopping Experience',
  'Support Speed',
  'Rewards & Payouts',
  'App Design',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'faq-shop',
    topic: 'Shopping & Products',
    question: 'Does Mezone sell inventory directly or allow user reselling?',
    answer:
      'No. Mezone is strictly a discovery and shopping storefront for official Temu and Amazon affiliate products. Clicking Shop Now opens the verified Temu or Amazon listing directly. Users do not stock or resell items on Mezone.',
  },
  {
    id: 'faq-proof',
    topic: 'Order Proof Verification',
    question: 'How do I submit Order Proof after buying from Temu or Amazon?',
    answer:
      'Go to Referral Program, enter the Product Name, Marketplace (Temu or Amazon), Order ID, Quantity, and upload a screenshot of your order receipt. After submitting, click Send to WhatsApp (+92 3312558875) to forward the screenshot to Mezone Admin.',
  },
  {
    id: 'faq-ref',
    topic: 'Referral Program',
    question: 'When is my 500 PKR referral reward accepted?',
    answer:
      'First verify your email to unlock your Invite ID. Share your Invite Code with friends. Once an invited user creates a Mezone account with your code and completes 10 Admin-approved product purchases with order proof, the referral is marked Accepted and +500 PKR is added to your wallet.',
  },
  {
    id: 'faq-wallet',
    topic: 'Wallet & Withdraw',
    question: 'What is the minimum withdrawal and how do taxes and fees work?',
    answer:
      'Your Mezone account must be verified and hold at least 1,000 PKR to withdraw. Every withdrawal applies 5% Tax and 2% Fee, so a 1,000 PKR request pays 930 PKR net to your submitted bank account details.',
  },
  {
    id: 'faq-bonuses',
    topic: 'Wallet & Withdraw',
    question: 'How do daily login tokens and profile bonuses work?',
    answer:
      'Verified accounts earn 100 PKR on account creation, 300 PKR after buying 2 approved products, 50 PKR after completing Personal Information, and 50 PKR when you collect 1,000 tokens across 30 daily logins.',
  },
  {
    id: 'faq-verify',
    topic: 'Account Verification',
    question: 'Why is my Profile DP read-only and what cell format is required?',
    answer:
      'Profile DP is automatically synced from your social or email Auth provider and cannot be manually replaced. Under Setting → Personal information, select your country code and enter your mobile number without a leading 0 (for example, +92 3001234567). Use Verification Center to confirm your Mail and Social Login accounts.',
  },
];

export function HelpcenterSection({
  uid,
  userName,
  userEmail,
  isVerified,
  profile,
  myTickets,
  feedbackList,
  onFlashStatus,
  onGoToVerificationCenter,
}: HelpcenterSectionProps) {
  const [selectedTopic, setSelectedTopic] = useState<'All Topics' | SupportTopic>('All Topics');
  const [faqQuery, setFaqQuery] = useState('');

  const [ticketTopic, setTicketTopic] = useState<SupportTopic>('Order Proof Verification');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Rating & Feedback state
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>('Shopping Experience');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    return HELP_ARTICLES.filter((article) => {
      const matchesTopic = selectedTopic === 'All Topics' || article.topic === selectedTopic;
      const matchesQuery =
        !q ||
        article.question.toLowerCase().includes(q) ||
        article.answer.toLowerCase().includes(q) ||
        article.topic.toLowerCase().includes(q);
      return matchesTopic && matchesQuery;
    });
  }, [selectedTopic, faqQuery]);

  const visibleFeedback = useMemo(
    () => feedbackList.filter((item) => item.published || item.userId === uid),
    [feedbackList, uid]
  );

  const averageRating = useMemo(() => {
    if (visibleFeedback.length === 0) return '0.0';
    const total = visibleFeedback.reduce((sum, item) => sum + (item.rating || 0), 0);
    return (total / visibleFeedback.length).toFixed(1);
  }, [visibleFeedback]);

  const handleSubmitTicket = async (e: FormEvent) => {
    e.preventDefault();
    setTicketError(null);

    setSubmittingTicket(true);
    try {
      await createSupportTicket({
        uid,
        userName: profile?.displayName || userName || 'Mezone Shopper',
        userEmail: profile?.email || userEmail,
        topic: ticketTopic,
        subject: ticketSubject,
        message: ticketMessage,
      });
      setTicketSubject('');
      setTicketMessage('');
      onFlashStatus('Helpcenter support ticket submitted. Our team will respond shortly.');
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSubmitFeedback = async (e: FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);

    setSubmittingFeedback(true);
    try {
      await submitHelpcenterFeedback({
        uid,
        userName: profile?.displayName || userName || 'Mezone Shopper',
        rating: ratingValue,
        category: feedbackCategory,
        comment: feedbackComment,
      });
      setFeedbackComment('');
      setRatingValue(5);
      onFlashStatus('Thank you for rating Mezone! Your feedback has been saved.');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const whatsappHelpUrl = `https://wa.me/${WHATSAPP_PROOF_NUMBER}?text=${encodeURIComponent(
    `Hello Mezone Support,\nName: ${profile?.displayName || userName}\nMail: ${userEmail}\nUID: ${uid}\nI need help with:`
  )}`;

  const activeStarDisplay = hoverRating || ratingValue;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#C2410C] mb-1">
            Mezone Customer Support, Ratings &amp; Guides
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111113]">
            Helpcenter
          </h1>
          <p className="text-sm text-[#57534E] mt-1 max-w-2xl">
            Answers for Temu &amp; Amazon shopping, order screenshot verification, 500 PKR referrals,
            wallet withdrawals, and community Rating &amp; Feedback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGoToVerificationCenter}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white border border-black/15 text-xs font-semibold text-[#111113] rounded-lg hover:bg-[#EFECE5] cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#EA580C]" />
            <span>Open Verification Center</span>
          </button>

          <a
            href={whatsappHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 px-4 bg-[#15803D] text-white text-xs font-semibold rounded-lg hover:bg-[#166534] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Support {WHATSAPP_PROOF_DISPLAY}</span>
          </a>
        </div>
      </div>

      {/* Rating & Feedback Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="pb-4 border-b border-black/10">
            <p className="text-xs font-medium text-[#C2410C] mb-1">Shopper Experience</p>
            <h2 className="text-base font-semibold text-[#111113]">
              Rate Mezone &amp; Share Feedback
            </h2>
            <p className="text-xs text-[#57534E] mt-1">
              Let us know how Mezone is working for your Temu &amp; Amazon shopping and rewards.
            </p>
          </div>

          {feedbackError && (
            <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
              {feedbackError}
            </div>
          )}

          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            <div>
              <span className="block text-xs font-medium text-[#111113] mb-2">
                Your Star Rating
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= activeStarDisplay;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRatingValue(star)}
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      className="p-1.5 rounded-lg bg-[#FAF9F6] border border-black/10 hover:border-[#EA580C] transition-colors cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          filled ? 'text-[#EA580C] fill-[#EA580C]' : 'text-[#78716C]'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-semibold text-[#111113] tabular-nums">
                  {activeStarDisplay}/5 · {RATING_LABELS[activeStarDisplay]}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="fb-category"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Feedback Area
              </label>
              <select
                id="fb-category"
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value as FeedbackCategory)}
                className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              >
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="fb-comment"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Your Feedback
              </label>
              <textarea
                id="fb-comment"
                rows={3}
                required
                minLength={3}
                maxLength={500}
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Share your experience with Mezone products, support, or payouts..."
                className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingFeedback}
              className="inline-flex items-center gap-2 h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{submittingFeedback ? 'Submitting...' : 'Submit Rating & Feedback'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-black/10 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#C2410C]">Verified Ratings</p>
              <h2 className="text-base font-semibold text-[#111113]">
                User Ratings &amp; Feedback ({visibleFeedback.length})
              </h2>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-black/10">
              <Star className="w-4 h-4 text-[#EA580C] fill-[#EA580C]" />
              <span className="font-mono text-sm font-bold text-[#111113] tabular-nums">
                {averageRating}
              </span>
              <span className="text-xs text-[#57534E]">/ 5.0</span>
            </div>
          </div>

          {visibleFeedback.length === 0 ? (
            <div className="p-6 text-xs text-[#57534E] leading-relaxed">
              No user ratings yet. Submit the first rating and feedback using the form!
            </div>
          ) : (
            <ul className="divide-y divide-black/10 max-h-[420px] overflow-y-auto">
              {visibleFeedback.map((item) => (
                <li key={item.id} className="p-6 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#111113]">
                          {item.userName}
                        </span>
                        <span className="text-[11px] font-medium text-[#C2410C]">
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= item.rating
                                ? 'text-[#EA580C] fill-[#EA580C]'
                                : 'text-[#D6D3D1]'
                            }`}
                          />
                        ))}
                        <span className="ml-1.5 text-[11px] font-mono text-[#57534E] tabular-nums">
                          {item.rating}/5
                        </span>
                      </div>
                    </div>

                    {item.userId === uid && (
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteHelpcenterFeedback(item.id);
                          onFlashStatus('Your feedback entry was deleted.');
                        }}
                        className="inline-flex items-center gap-1 text-xs text-[#9A3412] hover:underline cursor-pointer"
                        aria-label="Delete your feedback"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
                    {item.comment}
                  </p>

                  {item.adminReply && (
                    <div className="p-3 rounded-lg bg-[#FAF9F6] border border-black/10 text-xs text-[#111113]">
                      <span className="font-semibold text-[#C2410C]">Mezone Reply: </span>
                      {item.adminReply}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Search & FAQ Guide */}
      <div className="bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-5 h-5 text-[#EA580C]" />
            <h2 className="text-base font-semibold text-[#111113]">
              Knowledge Base &amp; Common Questions
            </h2>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-[#57534E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
              placeholder="Search Helpcenter..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFECE5] rounded-lg">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSelectedTopic(topic)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedTopic === topic
                  ? 'bg-white text-[#111113] shadow-sm'
                  : 'text-[#57534E] hover:text-[#111113]'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {filteredArticles.length === 0 ? (
          <p className="text-xs text-[#57534E] py-4">
            No help topics matched your search. Submit a support ticket below and Admin will reply.
          </p>
        ) : (
          <div className="divide-y divide-black/10">
            {filteredArticles.map((item) => (
              <div key={item.id} className="py-4 first:pt-1 last:pb-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#C2410C]">{item.topic}</p>
                <h3 className="text-sm font-semibold text-[#111113]">{item.question}</h3>
                <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact / Support Ticket + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white border border-black/10 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="pb-4 border-b border-black/10">
            <p className="text-xs font-medium text-[#C2410C] mb-1">Direct Helpdesk</p>
            <h2 className="text-base font-semibold text-[#111113]">
              Submit a Support Request
            </h2>
            <p className="text-xs text-[#57534E] mt-1">
              Need assistance with an order proof, referral credit, withdrawal, or login confirmation?
              Send a ticket directly to Mezone Support.
            </p>
          </div>

          {ticketError && (
            <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#EA580C]/30 text-xs text-[#9A3412]">
              {ticketError}
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label
                htmlFor="help-topic"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Support Topic
              </label>
              <select
                id="help-topic"
                value={ticketTopic}
                onChange={(e) => setTicketTopic(e.target.value as SupportTopic)}
                className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              >
                <option value="Shopping & Products">Shopping &amp; Products</option>
                <option value="Order Proof Verification">Order Proof Verification</option>
                <option value="Referral Program">Referral Program</option>
                <option value="Wallet & Withdraw">Wallet &amp; Withdraw</option>
                <option value="Account Verification">Account Verification</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="help-subject"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Subject
              </label>
              <input
                id="help-subject"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Temu order proof confirmation check"
                className="w-full h-10 px-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              />
            </div>

            <div>
              <label
                htmlFor="help-message"
                className="block text-xs font-medium text-[#111113] mb-1.5"
              >
                Message Details
              </label>
              <textarea
                id="help-message"
                rows={4}
                required
                minLength={5}
                maxLength={600}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Include order ID, account ID, or clear details so support can resolve this quickly..."
                className="w-full p-3 text-sm bg-[#FAF9F6] border border-black/15 rounded-lg text-[#111113]"
              />
            </div>

            <button
              type="submit"
              disabled={submittingTicket}
              className="inline-flex items-center gap-2 h-10 px-5 bg-[#EA580C] text-white text-xs font-semibold rounded-lg hover:bg-[#C2410C] disabled:opacity-60 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingTicket ? 'Submitting...' : 'Submit Support Ticket'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 bg-white border border-black/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#C2410C]">Ticket History</p>
              <h2 className="text-base font-semibold text-[#111113]">
                Your Support Tickets ({myTickets.length})
              </h2>
            </div>
          </div>

          {myTickets.length === 0 ? (
            <div className="p-6 text-xs text-[#57534E] leading-relaxed">
              No support tickets submitted yet. Use the form to reach Mezone Support, or chat directly
              on WhatsApp ({WHATSAPP_PROOF_DISPLAY}).
            </div>
          ) : (
            <ul className="divide-y divide-black/10">
              {myTickets.map((ticket) => (
                <li key={ticket.id} className="p-6 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-[#57534E]">{ticket.topic}</p>
                      <h3 className="text-sm font-semibold text-[#111113]">{ticket.subject}</h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold capitalize shrink-0 ${
                        ticket.status === 'resolved' ? 'text-emerald-700' : 'text-[#C2410C]'
                      }`}
                    >
                      {ticket.status === 'resolved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">{ticket.message}</p>
                  {ticket.adminReply && (
                    <div className="mt-2 p-3 rounded-lg bg-[#FAF9F6] border border-black/10 text-xs text-[#111113]">
                      <span className="font-semibold text-[#C2410C]">Support Reply: </span>
                      {ticket.adminReply}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
