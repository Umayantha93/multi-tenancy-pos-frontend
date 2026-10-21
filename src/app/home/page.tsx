import type { Metadata } from "next";
import Link from "next/link";
import { IubitsLogo } from "@/components/iubits-logo";

export const metadata: Metadata = {
  title: "IUBits | POS, ERP, and websites",
  description:
    "IUBits builds a point-of-sale system for garages, shops, studios, salons, and cottages, plus ERP systems and responsive websites.",
};

const trades = [
  {
    name: "Garages",
    detail:
      "Admit a vehicle, open a repair job, a service job, or both on one card, sell parts from stock, and follow the job until it is paid.",
  },
  {
    name: "Paint shops",
    detail:
      "Admit the vehicle, bill panel labor, and draw colour and material from stock. The counter can also sell paint without opening a full job.",
  },
  {
    name: "Tyre shops",
    detail:
      "Admit the vehicle, bill fitting labor, and sell tyres and parts from inventory, with suppliers and warranties available on the same account.",
  },
  {
    name: "Device repair",
    detail:
      "Admit a phone or appliance, bill labor and spares, and track unique units by IMEI or serial when that module is on.",
  },
  {
    name: "Stores",
    detail:
      "Sell from the counter, keep stock, and optionally add repair bills, warranties, purchase orders, and serial numbers.",
  },
  {
    name: "Mobile shops",
    detail:
      "Sell handsets and accessories, look up a unit by IMEI, and run repair bills and warranties beside the sales counter.",
  },
  {
    name: "Garment shops",
    detail:
      "Ring up clothing at the counter, keep a catalog with sizes, bill alterations, and set sales targets for the team.",
  },
  {
    name: "Salons",
    detail:
      "Book appointments, sell service packages and add-ons, and ring up retail products from the same till.",
  },
  {
    name: "Photography studios",
    detail:
      "Book a shoot, price packages and prints, and take payment on an order that stays tied to the customer.",
  },
  {
    name: "Cottages",
    detail:
      "Keep rooms and nightly rates, check guests in, and bill room nights, meals, and extras on one stay.",
  },
];

const featureGroups = [
  {
    title: "Selling and billing",
    items: [
      ["Billing", "Quotations, job cards, orders, and sales. Record cash, card, bank, and cheque, and keep the balance that is still owed."],
      ["Counter sale", "An instant bill for a walk-in. Garages and workshops use it for a quick part sale. Clothing shops, salons, stores, and mobile shops use it as the till."],
      ["Customers", "A directory of people you serve, with their history, outstanding balance, and a statement you can open for one customer."],
      ["Line discount", "A discount on a single line, between the rate and the total. A line that falls under cost after the discount is flagged."],
      ["Bill by SMS", "Send the customer a link to the quotation or the paid bill."],
      ["WhatsApp bill", "Share that same bill link on WhatsApp."],
      ["Owner bill SMS", "When staff send a bill by SMS, the shop owner can receive the same link."],
      ["Warranties", "Put a warranty on a job or a sale in months or years, and look it up later."],
      ["Bill profits", "See revenue, the cost of stock used, and profit, including bills that are still on credit."],
    ],
  },
  {
    title: "Workshop and jobs",
    items: [
      ["Admit a vehicle", "Open a job card when a vehicle arrives. Device repair uses the same step to admit a phone or appliance."],
      ["Repair and service", "Garages can keep mechanical repair and periodic service as separate kinds of work, or put both on one card."],
      ["Admit photos", "Attach up to five photos when the vehicle is admitted."],
      ["Job board", "A board of open jobs so the floor can see what is waiting, in progress, and ready."],
      ["Bay calendar", "A day view of bays, time slots, the vehicle in each bay, and the technician on it."],
      ["Job photos and videos", "Up to fifteen photos and five short clips on a garage job. The customer sees them on the bill link. They are removed after six months."],
      ["Technicians on the bill", "Print the technician’s name on each labor and service line."],
      ["Free service", "Mark a job free for the customer, including parts. Technician commission still uses the line prices."],
      ["Job commission", "Commission for the people assigned to a job card, posted into finance."],
      ["Next-service reminders", "An SMS or WhatsApp before the next service date, for garages that run service jobs and bill SMS."],
      ["Studio bookings and packages", "Photography sessions, priced packages, prints, and add-ons."],
      ["Salon appointments", "The same booking book used for salon appointments, packages, and add-ons."],
      ["Cottage stays", "Rooms, nightly rates, check-in, and charges for meals and extras."],
      ["Store and phone repairs", "A repair bill next to counter sales, with its own profit, for stores and mobile shops."],
    ],
  },
  {
    title: "Stock and suppliers",
    items: [
      ["Inventory", "Parts, tyres, colour, spares, and shop items. Selling a stocked line reduces the quantity on hand."],
      ["Edit inventory", "The owner can add, change, and remove items, including the quantity on hand. A staff login can do that only when the owner allows it."],
      ["Product catalog", "Clothing and salon retail: items, sizes, and stock for the counter."],
      ["Suppliers", "A supplier list and goods-received notes when stock comes in."],
      ["Purchase orders", "Raise a purchase order, receive part of it, record the goods receipt, and track what you still owe the supplier."],
      ["Part fitment", "Cross-reference a part and see which vehicle it fits while you are at the counter."],
      ["IMEI and serial stock", "Phones and devices kept as individual units, each with an IMEI or serial, rather than a single quantity."],
      ["Station consumables", "Issue a bulk tin, such as shampoo or a wash chemical, to the bay. Stock drops when the tin is opened, and the cost of each wash is worked out from the services you billed."],
      ["Several shops", "One business can run more than one shop, and move stock from one shop to another."],
    ],
  },
  {
    title: "Team, payroll, and money",
    items: [
      ["Team", "Employee records, a home shop, and a link from the person to their staff login."],
      ["Shifts and leave", "Staff see their own shifts and apply for leave. The owner approves leave."],
      ["Targets", "Sales targets for a garment team."],
      ["Attendance", "Punch in and out, and review the month."],
      ["Payroll", "Monthly pay calculated from attendance."],
      ["Staff access", "The owner chooses which modules each staff login can open. Turning a module off hides it from that person’s menu."],
      ["Finance", "Income, expenses, and profit for the month. Garage accounts can split every expense into repair or service and see the two totals apart."],
      ["Day-end cash-up", "Cash, card, bank, and cheque against the drawer count, for each cashier and each shop."],
      ["Reports", "Trends for the business. Garages can also count billed service add-ons, sold quantity against a full service, and the revenue from them."],
      ["Finance download", "The monthly finance report as Excel or PDF: the daily table alone, or every day’s lines as well."],
      ["English and Sinhala", "The working screens can be switched between English and Sinhala. Money is kept in Sri Lankan rupees."],
    ],
  },
];

const otherWork = [
  {
    kicker: "Systems",
    title: "ERP",
    body: "For a company whose work runs past the counter, IUBits builds an ERP around purchasing, stock, production, and accounts. The system follows that company’s own steps, documents, and approvals.",
  },
  {
    kicker: "Web",
    title: "Websites",
    body: "Static sites for a fixed story — a workshop, a studio, a product line — and dynamic sites whose pages, catalogs, and forms change as the business does. Both are laid out for a phone and for a wide screen.",
  },
];

export default function CompanyHomePage() {
  return (
    <div className="min-h-screen text-[#20221f]">
      <header className="sticky top-0 z-20 border-b border-[#d7d3c8] bg-[#fbfaf6]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link href="/home" className="mr-auto">
            <IubitsLogo tone="onLight" size="sm" />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#3c423c]">
            <a href="#pos" className="hover:text-[#167c73]">The POS</a>
            <a href="#trades" className="hover:text-[#167c73]">Who it is for</a>
            <a href="#features" className="hover:text-[#167c73]">Features</a>
            <a href="#other" className="hover:text-[#167c73]">ERP and websites</a>
            <Link href="/home/contact" className="hover:text-[#167c73]">Contact</Link>
          </nav>
          <Link href="/login" className="inline-flex h-9 items-center bg-[#20221f] px-4 text-sm font-semibold text-white hover:bg-[#167c73]">
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#242723] text-white">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(125deg, transparent 0 36px, #f5c842 37px 38px)" }} />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.3fr_0.7fr] lg:py-24">
            <div>
              <p className="font-display text-lg uppercase text-[#f5c842]">IUBits</p>
              <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold uppercase leading-[0.9] sm:text-7xl">
                Software for the business you actually run
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/80">
                IUBits is a software company. The main service is a point-of-sale and operations system: the counter, the job, the stock, the team, and the books in one place. Each business gets its own account.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#pos" className="inline-flex h-11 items-center bg-[#f5c842] px-5 text-sm font-semibold text-[#20221f] hover:bg-white">
                  Read about the POS
                </a>
                <Link href="/login" className="inline-flex h-11 items-center border border-white/30 px-5 text-sm font-semibold text-white hover:border-[#f5c842] hover:text-[#f5c842]">
                  Open your account
                </Link>
              </div>
            </div>
            <aside className="border border-white/15 bg-white/5 p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-[#f5c842]">What IUBits delivers</p>
              <ol className="mt-4 space-y-4 text-sm leading-6 text-white/85">
                <li><strong className="block text-white">Point of sale</strong>The product most customers use, built for a specific trade rather than a generic till.</li>
                <li><strong className="block text-white">ERP</strong>A wider operations system when the company needs more than the counter.</li>
                <li><strong className="block text-white">Websites</strong>Static and dynamic sites that stay readable on a phone and on a desktop.</li>
              </ol>
            </aside>
          </div>
        </section>

        <section id="pos" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <p className="text-xs font-bold uppercase tracking-wide text-[#167c73]">Main service</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold uppercase leading-none sm:text-5xl">
            A POS that knows the trade
          </h2>
          <div className="mt-6 grid gap-8 text-sm leading-7 text-[#3c423c] lg:grid-cols-2">
            <p>
              A shop owner signs in and works in their own business. Staff sign in on the same account with only the modules the owner has turned on for them. Bills, stock, attendance, and finance stay inside that business. A second shop can be added, and stock can move between shops.
            </p>
            <p>
              The screens change with the trade. A garage admits a vehicle and writes a job card. A clothing shop rings up a garment. A cottage checks a guest into a room. The shared pieces — customers, payments, payroll, and reports — sit under that difference, so a tyre shop is not asked to run a photography package, and a studio is not asked to count engine oil.
            </p>
          </div>
          <dl className="mt-10 grid gap-px bg-[#d7d3c8] sm:grid-cols-3">
            {[
              ["Owner", "Runs the business, sees finance, and decides what each staff login can open."],
              ["Staff", "Bills, restocks, and uses only the modules the owner has allowed. They can see their own shifts and apply for leave."],
              ["IUBits", "Sets up the business, chooses the trade, and turns the optional modules on for that account."],
            ].map(([title, body]) => (
              <div key={title} className="bg-[#fbfaf6] p-5">
                <dt className="font-display text-2xl font-semibold uppercase">{title}</dt>
                <dd className="mt-2 text-sm leading-6 text-[#3c423c]">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="trades" className="border-y border-[#d7d3c8] bg-[#fbfaf6]">
          <div className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
            <p className="text-xs font-bold uppercase tracking-wide text-[#167c73]">Customers</p>
            <h2 className="mt-2 font-display text-4xl font-semibold uppercase leading-none sm:text-5xl">Who the POS is for</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3c423c]">
              Ten trades. Each account is opened as one of these, and the menu, the bill lines, and the daily work follow that choice.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {trades.map((trade) => (
                <li key={trade.name} className="border border-[#d7d3c8] bg-[#f3f0e8] p-5">
                  <h3 className="font-display text-2xl font-semibold uppercase">{trade.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#3c423c]">{trade.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <p className="text-xs font-bold uppercase tracking-wide text-[#167c73]">What is in the system</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold uppercase leading-none sm:text-5xl">
            Features, by the work they do
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#3c423c]">
            A new account starts with the modules that trade needs every day. Extra modules stay off until IUBits turns them on for that business. Staff then see only what the owner allows.
          </p>
          <div className="mt-10 space-y-12">
            {featureGroups.map((group) => (
              <div key={group.title}>
                <h3 className="border-b border-[#d7d3c8] pb-3 font-display text-3xl font-semibold uppercase">{group.title}</h3>
                <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {group.items.map(([name, detail]) => (
                    <div key={name}>
                      <dt className="text-sm font-semibold">{name}</dt>
                      <dd className="mt-1 text-sm leading-6 text-[#3c423c]">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section id="other" className="border-t border-[#d7d3c8] bg-[#242723] text-white">
          <div className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
            <p className="text-xs font-bold uppercase tracking-wide text-[#f5c842]">Besides the POS</p>
            <h2 className="mt-2 font-display text-4xl font-semibold uppercase leading-none sm:text-5xl">ERP systems and websites</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {otherWork.map((item) => (
                <article key={item.title} className="border border-white/15 p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#f5c842]">{item.kicker}</p>
                  <h3 className="mt-2 font-display text-3xl font-semibold uppercase">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/80">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d7d3c8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <IubitsLogo tone="onLight" size="sm" />
          <p className="text-sm text-[#6f746e]">Point of sale, ERP, and websites.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/home/contact" className="text-sm font-semibold text-[#167c73] hover:underline">
              Contact us
            </Link>
            <Link href="/login" className="text-sm font-semibold text-[#167c73] hover:underline">
              Sign in to your business
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
