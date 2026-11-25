import { AIMessage } from "@/types";

export const INITIAL_AI_MESSAGES: AIMessage[] = [
  {
    id: "msg-welcome",
    sender: "assistant",
    content:
      "Hello! I am Healthcare's AI Health Navigator. I can assist you with understanding common medical symptoms, preparing questions for your doctor consultation, interpreting clinical terminology in medical reports, or matching you with verified medical specialists.\n\n*Note: This is an intelligent navigation and educational interface. I do not provide diagnostic claims or replace the clinical judgment of a qualified medical practitioner.*",
    timestamp: "Just now",
    category: "general",
    assessmentDisclaimer: true,
  },
];

export const SUGGESTED_PROMPTS = [
  {
    title: "Symptom Assessment",
    prompt: "I have had a mild throbbing headache behind my right eye for 2 days with light sensitivity.",
    icon: "Activity",
    category: "symptom-check" as const,
  },
  {
    title: "Understand Lab Report",
    prompt: "Can you explain what an elevated HbA1c of 6.2% means on my routine metabolic panel?",
    icon: "FileText",
    category: "report-analysis" as const,
  },
  {
    title: "Find Best Specialist",
    prompt: "Which specialist should I consult for persistent lower back stiffness radiating to the right thigh?",
    icon: "UserCheck",
    category: "doctor-recommendation" as const,
  },
  {
    title: "Appointment Prep",
    prompt: "What questions should I prepare for my upcoming first consultation with a cardiologist?",
    icon: "HelpCircle",
    category: "general" as const,
  },
];

export const SIMULATED_RESPONSES: Record<string, { content: string; followUps: string[]; recommendedSpecialties?: string[]; recommendedDoctors?: string[] }> = {
  headache: {
    content:
      "A unilateral (one-sided) throbbing headache accompanied by photophobia (light sensitivity) is characteristic of a migraine-type headache. Other contributing factors can include tension, eye strain, dehydration, or sleep disruptions.\n\n**Recommended next steps:**\n1. Rest in a dark, quiet room with adequate hydration.\n2. Keep a headache log noting duration, triggers, and pain severity.\n3. **Red Flag Warning:** If the headache is sudden, severe ('thunderclap'), accompanied by high fever, neck stiffness, confusion, or visual loss, seek emergency care immediately.\n\nWe recommend booking a consultation with a neurologist or general physician for an accurate medical evaluation.",
    followUps: [
      "Book an online consultation with a Neurologist",
      "What lifestyle factors trigger migraines?",
      "How to prepare a symptom log for the doctor?",
    ],
    recommendedSpecialties: ["Neurology", "General Physician"],
    recommendedDoctors: ["doc-3", "doc-7"],
  },
  hba1c: {
    content:
      "An HbA1c value of **6.2%** falls in the **Prediabetes range** (standard clinical reference: Normal is <5.7%, Prediabetes is 5.7% to 6.4%, and Diabetes is ≥6.5%).\n\n**Key Takeaways:**\n- Prediabetes signifies higher-than-normal blood glucose over the past 90 days, but it is **highly reversible** through lifestyle, dietary, and exercise interventions.\n- It indicates insulin resistance that can be corrected before progressing to clinical Type 2 Diabetes.\n\n**Suggested Questions for your Physician:**\n1. Should I undergo a fasting plasma glucose or oral glucose tolerance test?\n2. What dietary carbohydrate and glycemic index adjustments should I implement?\n3. Would a follow-up test in 3 months be appropriate?",
    followUps: [
      "Consult Dr. Vikramaditya Sen (Diabetologist)",
      "What are the best dietary strategies for prediabetes?",
      "Are there complementary tests I should request?",
    ],
    recommendedSpecialties: ["General Physician"],
    recommendedDoctors: ["doc-7"],
  },
  backpain: {
    content:
      "Stiffness in the lower back that radiates down into the thigh is clinically known as **radiculopathy** or nerve irritation (frequently affecting the sciatic nerve). Common causes include lumbar muscle spasm, lumbar disc protrusion, or sacroiliac joint inflammation.\n\n**Recommended Specialty:**\nYou should consult an **Orthopedic Specialist** or a **Neurologist / Spine Specialist** for a physical mobility exam and potential diagnostic imaging (such as an MRI or X-ray).\n\n**Immediate supportive measures:**\n- Avoid heavy lifting, sudden twisting, or soft slouching chairs.\n- Apply warm compresses for muscle relief.\n- Maintain gentle short walks if pain permits; avoid prolonged bed rest.",
    followUps: [
      "View verified Orthopedic Surgeons",
      "When is an MRI needed for back pain?",
      "Safe stretches for lower back tension",
    ],
    recommendedSpecialties: ["Orthopedics", "Neurology"],
    recommendedDoctors: ["doc-5", "doc-3"],
  },
  default: {
    content:
      "Thank you for sharing your health query. Based on your description, here are structured health insights to guide your decision.\n\nMedical conditions are best evaluated in a personalized clinical setting where a doctor can review your physical signs, history, and test reports.\n\nWould you like to connect with one of our verified specialists for a private video or in-person consultation?",
    followUps: [
      "Find top-rated doctors nearby",
      "Check available consultation slots today",
      "How does online prescription delivery work?",
    ],
    recommendedSpecialties: ["General Physician"],
    recommendedDoctors: ["doc-7", "doc-1"],
  },
};
