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
      "All treatments performed at our clinic are covered by our warranty. Should a warranted issue arise, any necessary corrective treatment will be provided free of charge, with all clinical costs fully covered by the clinic.",
      "The patient is responsible only for travel-related expenses. The warranty remains valid provided that all post-treatment instructions and follow-up recommendations issued by our medical team have been followed.",
      "We exclusively use premium-quality dental materials and adhere to internationally recognized clinical protocols and strict hygiene standards, including ISO 9001 certification. The authenticity and origin of all implant materials can be verified through the implant passport and traceability documentation provided.",
    ],
    paymentTitle: "Payment",
    paymentLines: [
      "Payments may be made by cash, bank transfer, or POS card payment at the clinic (card payments are subject to a 3% processing fee).",
      "For bank transfers, we recommend informing your bank in advance of your intention to make an international transfer to Albania to avoid potential delays or transaction restrictions.",
      "Please note that payments by cheque and American Express are not accepted.",
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
      "Tutti i trattamenti eseguiti presso la nostra clinica sono coperti dalla nostra garanzia. Qualora dovesse presentarsi un problema coperto da garanzia, l'eventuale trattamento correttivo necessario sarà fornito gratuitamente, con tutti i costi clinici interamente a carico della clinica.",
      "Il paziente è responsabile solo delle spese di viaggio. La garanzia rimane valida a condizione che siano state seguite tutte le istruzioni post-trattamento e le raccomandazioni di follow-up fornite dal nostro team medico.",
      "Utilizziamo esclusivamente materiali dentali di alta qualità e rispettiamo protocolli clinici riconosciuti a livello internazionale e rigorosi standard igienici, inclusa la certificazione ISO 9001. L'autenticità e l'origine di tutti i materiali implantari possono essere verificate tramite il passaporto dell'impianto e la documentazione di tracciabilità fornita.",
    ],
    paymentTitle: "Pagamento",
    paymentLines: [
      "I pagamenti possono essere effettuati in contanti, tramite bonifico bancario o con carta POS in clinica (i pagamenti con carta sono soggetti a una commissione del 3%).",
      "Per i bonifici bancari, si consiglia di informare in anticipo la propria banca dell'intenzione di effettuare un bonifico internazionale verso l'Albania, per evitare possibili ritardi o restrizioni sulla transazione.",
      "Si prega di notare che non si accettano pagamenti tramite assegno o American Express.",
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
      "Tous les traitements effectués dans notre clinique sont couverts par notre garantie. En cas de problème couvert par la garantie, tout traitement correctif nécessaire sera fourni gratuitement, l'intégralité des frais cliniques étant pris en charge par la clinique.",
      "Le patient n'est responsable que des frais de déplacement. La garantie reste valable à condition que toutes les instructions post-traitement et recommandations de suivi émises par notre équipe médicale aient été respectées.",
      "Nous utilisons exclusivement des matériaux dentaires haut de gamme et respectons des protocoles cliniques reconnus internationalement ainsi que des normes d'hygiène strictes, y compris la certification ISO 9001. L'authenticité et l'origine de tous les matériaux implantaires peuvent être vérifiées grâce au passeport de l'implant et à la documentation de traçabilité fournie.",
    ],
    paymentTitle: "Paiement",
    paymentLines: [
      "Les paiements peuvent être effectués en espèces, par virement bancaire ou par carte (POS) à la clinique (les paiements par carte sont soumis à des frais de traitement de 3 %).",
      "Pour les virements bancaires, nous vous recommandons d'informer votre banque à l'avance de votre intention d'effectuer un virement international vers l'Albanie afin d'éviter d'éventuels retards ou restrictions de transaction.",
      "Veuillez noter que les paiements par chèque et American Express ne sont pas acceptés.",
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
