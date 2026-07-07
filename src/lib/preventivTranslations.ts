export type PreventivLang = "en" | "it" | "fr";

export interface PreventivStrings {
  quote: string;
  patient: string;
  date: string;
  validUntil: string;
  service: string;
  qty: string;
  price: string;
  discount: string;
  total: string;
  notes: string;
  warrantyTitle: string;
  warrantyLines: string[];
  paymentTitle: string;
  paymentLines: string[];
  servicesTitle: string;
  servicesLines: string[];
  defaultSectionName: string;
  upperJaw: string;
  lowerJaw: string;
}

export const PREVENTIV_STRINGS: Record<PreventivLang, PreventivStrings> = {
  en: {
    quote: "QUOTE",
    patient: "PATIENT",
    date: "DATE",
    validUntil: "VALID UNTIL",
    service: "SERVICE",
    qty: "QTY",
    price: "PRICE",
    discount: "DISCOUNT",
    total: "TOTAL",
    notes: "NOTES",
    warrantyTitle: "Warranty",
    warrantyLines: [
      "All treatments performed at our clinic are covered by a warranty.",
      "The warranty covers the cost of any necessary corrective treatment, which will be provided **free of charge** and fully covered by the clinic. If a warranty-related issue arises, the patient is only responsible for **travel and accommodation expenses**.",
      "The warranty remains valid provided that the patient follows all post-treatment instructions and recommendations given by our medical team.",
      "We use only **high-quality, internationally recognized dental materials** and follow strict international clinical protocols and hygiene standards, including **ISO 9001** quality management standards.",
      "For complete transparency, we provide documentation confirming the origin and authenticity of all implant materials, including an **implant passport** and **traceability certificate**.",
    ],
    paymentTitle: "Payment",
    paymentLines: [
      "We accept the following payment methods:",
      "- **Cash**",
      "- **Card payment (POS terminal)** at the clinic (a 3% processing fee applies)",
      "- **Bank transfer**",
      "If you choose to pay by **bank transfer**, please inform your bank in advance that you intend to make an international transfer while you are in **Albania**. This helps prevent any potential issues, such as payment blocks, security restrictions, or difficulties authorizing the transfer through your bank's mobile application while abroad.",
      "**Please note:** We do **not** accept **checks** or **American Express** cards.",
    ],
    servicesTitle: "Services Included in the Package",
    servicesLines: [
      "Accommodation",
      "Airport pick-up and drop-off service",
      "Assistance throughout the entire stay",
      "Final consultation and check-up",
      "Certified CE products (European standards)",
      "Written guarantee with implant passport",
    ],
    defaultSectionName: "Services",
    upperJaw: "Upper Jaw",
    lowerJaw: "Lower Jaw",
  },
  it: {
    quote: "PREVENTIVO",
    patient: "PAZIENTE",
    date: "DATA",
    validUntil: "VALIDO FINO AL",
    service: "SERVIZIO",
    qty: "QUANTITÀ",
    price: "PREZZO",
    discount: "SCONTO",
    total: "TOTALE",
    notes: "NOTE",
    warrantyTitle: "Garanzia",
    warrantyLines: [
      "Tutti i trattamenti eseguiti presso la nostra clinica sono coperti da garanzia.",
      "La garanzia copre il costo di qualsiasi trattamento correttivo necessario, che sarà fornito **gratuitamente** e interamente a carico della clinica. In caso di un problema coperto da garanzia, il paziente sarà responsabile solo delle **spese di viaggio e soggiorno**.",
      "La garanzia rimane valida a condizione che il paziente segua tutte le istruzioni post-trattamento e le raccomandazioni fornite dal nostro team medico.",
      "Utilizziamo esclusivamente **materiali dentali di alta qualità, riconosciuti a livello internazionale** e rispettiamo rigorosi protocolli clinici internazionali e standard igienici, inclusi gli standard di gestione della qualità **ISO 9001**.",
      "Per garantire piena trasparenza, forniamo documentazione che conferma l'origine e l'autenticità di tutti i materiali implantari, incluso un **passaporto dell'impianto** e un **certificato di tracciabilità**.",
    ],
    paymentTitle: "Pagamento",
    paymentLines: [
      "Accettiamo i seguenti metodi di pagamento:",
      "- **Contanti**",
      "- **Pagamento con carta (terminale POS)** in clinica (si applica una commissione del 3%)",
      "- **Bonifico bancario**",
      "Se scegli di pagare tramite **bonifico bancario**, ti consigliamo di informare in anticipo la tua banca della tua intenzione di effettuare un bonifico internazionale mentre ti trovi in **Albania**. Questo aiuta a prevenire eventuali problemi, come blocchi dei pagamenti, restrizioni di sicurezza o difficoltà nell'autorizzare il bonifico tramite l'app bancaria mentre sei all'estero.",
      "**Nota bene:** non accettiamo **assegni** né carte **American Express**.",
    ],
    servicesTitle: "Servizi Inclusi nel Pacchetto",
    servicesLines: [
      "Alloggio",
      "Servizio di transfer da/per l'aeroporto",
      "Assistenza per tutta la durata del soggiorno",
      "Consulto e controllo finale",
      "Prodotti certificati CE (standard europei)",
      "Garanzia scritta con passaporto dell'impianto",
    ],
    defaultSectionName: "Servizi",
    upperJaw: "Arcata Superiore",
    lowerJaw: "Arcata Inferiore",
  },
  fr: {
    quote: "DEVIS",
    patient: "PATIENT",
    date: "DATE",
    validUntil: "VALABLE JUSQU'AU",
    service: "SERVICE",
    qty: "QTÉ",
    price: "PRIX",
    discount: "REMISE",
    total: "TOTAL",
    notes: "REMARQUES",
    warrantyTitle: "Garantie",
    warrantyLines: [
      "Tous les traitements effectués dans notre clinique sont couverts par une garantie.",
      "La garantie couvre le coût de tout traitement correctif nécessaire, qui sera fourni **gratuitement** et entièrement pris en charge par la clinique. En cas de problème couvert par la garantie, le patient n'est responsable que des **frais de déplacement et de séjour**.",
      "La garantie reste valable à condition que le patient respecte toutes les instructions post-traitement et les recommandations fournies par notre équipe médicale.",
      "Nous utilisons exclusivement des **matériaux dentaires haut de gamme, reconnus internationalement** et respectons des protocoles cliniques internationaux stricts ainsi que des normes d'hygiène rigoureuses, y compris les normes de gestion de la qualité **ISO 9001**.",
      "Par souci de transparence totale, nous fournissons une documentation confirmant l'origine et l'authenticité de tous les matériaux implantaires, y compris un **passeport de l'implant** et un **certificat de traçabilité**.",
    ],
    paymentTitle: "Paiement",
    paymentLines: [
      "Nous acceptons les modes de paiement suivants :",
      "- **Espèces**",
      "- **Paiement par carte (terminal POS)** à la clinique (des frais de traitement de 3 % s'appliquent)",
      "- **Virement bancaire**",
      "Si vous choisissez de payer par **virement bancaire**, nous vous recommandons d'informer votre banque à l'avance de votre intention d'effectuer un virement international pendant que vous êtes en **Albanie**. Cela permet d'éviter d'éventuels problèmes, tels que des blocages de paiement, des restrictions de sécurité ou des difficultés à autoriser le virement via l'application mobile de votre banque depuis l'étranger.",
      "**Veuillez noter :** nous n'acceptons ni les **chèques** ni les cartes **American Express**.",
    ],
    servicesTitle: "Services Inclus dans le Forfait",
    servicesLines: [
      "Hébergement",
      "Service de transfert aéroport (arrivée/départ)",
      "Assistance pendant tout le séjour",
      "Consultation et contrôle final",
      "Produits certifiés CE (normes européennes)",
      "Garantie écrite avec passeport de l'implant",
    ],
    defaultSectionName: "Services",
    upperJaw: "Arcade Supérieure",
    lowerJaw: "Arcade Inférieure",
  },
};
