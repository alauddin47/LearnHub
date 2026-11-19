// Curriculum data. Resource links are SEARCH LINKS until an admin verifies and saves a specific URL.
const yt = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);

const GRAMMAR_TOPICS = [
 // Weeks 1-2: Foundations
 "Parts of speech","Nouns: countable and uncountable","Articles: a, an, the","Pronouns","Possessives and determiners",
 "Adjectives: order and use","Adverbs: form and position","Prepositions of time","Prepositions of place and movement","Present simple",
 "Present continuous","Stative verbs",
 // Weeks 3-4: Tenses
 "Past simple","Past continuous","Present perfect simple","Present perfect continuous","Present perfect vs past simple","Past perfect",
 "Past perfect continuous","Future: will and going to","Future continuous and future perfect","Used to and would","Time clauses and sequencing","Tense review and error correction",
 // Weeks 5-6: Verbs
 "Modal verbs: ability and permission","Modal verbs: obligation and advice","Modal verbs of deduction","Past modals","Passive voice: present and past","Passive voice: other tenses",
 "Causative: have/get something done","Phrasal verbs","Gerunds and infinitives","Verbs followed by -ing or to","Question forms","Question tags and short answers",
 // Weeks 7-8: Clauses
 "Zero and first conditional","Second conditional","Third conditional and mixed conditionals","Wishes and regrets","Relative clauses: defining","Relative clauses: non-defining",
 "Reduced relative clauses","Reported speech: statements","Reported speech: questions and commands","Reporting verbs","Conjunctions and linking words","Noun clauses",
 // Weeks 9-10: Accuracy & Style
 "Comparatives and superlatives","Quantifiers: some, any, much, many","Too, enough, so, such","Subject-verb agreement","Inversion for emphasis","Cleft sentences",
 "The subjunctive","Participle clauses","Ellipsis and substitution","Punctuation essentials","Sentence structure: simple, compound, complex","Avoiding run-ons and fragments",
 // Weeks 11-12: Application
 "Formal vs informal register","Collocations","Word formation: prefixes and suffixes","Confusing words","Paragraph writing","Cohesion and coherence",
 "Email and letter writing","Opinion essay structure","Summarising and paraphrasing","Speaking: describing and narrating","Speaking: discussing and justifying","Final review and mock test"
].map((title, i) => ({
  id: "g" + (i + 1), day: i + 1, week: Math.floor(i / 6) + 1, title,
  video: yt("engvid " + title + " English grammar lesson"),
  videoLabel: "Search EngVid for this topic",
  ref: "Michael Swan, Practical English Usage (3rd ed.) — look up the entry for “" + title + "” in the index; Graham Workman, Concept and Timeline — see the matching tense/timeline unit.",
  refUrl: "https://global.oup.com/academic/product/practical-english-usage-9780194202466",
  refLabel: "Publisher page: Practical English Usage (OUP)",
  verified: false
}));

const GRAMMAR_ASSIGNMENTS = Array.from({length: 12}, (_, i) => ({
  id: "ga" + (i + 1), week: i + 1,
  title: "Week " + (i + 1) + " writing task",
  prompt: "Write 100–150 words using the grammar from this week's lessons (" +
    GRAMMAR_TOPICS.filter(t => t.week === i + 1).map(t => t.title).join("; ") + "). Underline two examples of target structures."
}));

const IELTS_MODULES = [
 {id:"listening", name:"Listening", icon:"🎧", source:"IELTS Liz", channelQ:"IELTS Liz listening", topics:[
  "Section 1: form and note completion","Section 2: map and plan labelling","Multiple choice questions","Matching and classification","Sentence and summary completion","Sections 3–4: academic discussion and lecture","Spelling, plurals and numbers","Distractors and paraphrase"]},
 {id:"reading", name:"Reading", icon:"📖", source:"IELTS Liz", channelQ:"IELTS Liz reading", topics:[
  "Skimming and scanning","True / False / Not Given","Matching headings","Summary and sentence completion","Multiple choice questions","Matching information and features","Time management","Vocabulary from context"]},
 {id:"writing", name:"Writing", icon:"✍️", source:"IELTS Advantage (Chris Pell)", channelQ:"IELTS Advantage", topics:[
  "Task 1: line graphs","Task 1: bar charts and pie charts","Task 1: tables","Task 1: process diagrams","Task 1: maps","Task 1: overview paragraphs",
  "Task 2: opinion essays","Task 2: discussion essays","Task 2: problem–solution essays","Task 2: advantages and disadvantages","Task 2: introductions and conclusions","Coherence, cohesion and band descriptors"]},
 {id:"speaking", name:"Speaking", icon:"🗣️", source:"E2 IELTS (E2Language)", channelQ:"E2 IELTS speaking", topics:[
  "Part 1: familiar topics","Part 2: the cue card","Part 3: abstract discussion","Fluency and coherence","Pronunciation and intonation","Lexical resource and idioms","Mock speaking test with feedback"]}
].map(m => ({...m, topics: m.topics.map((t, i) => ({
  id: "i-" + m.id + "-" + (i + 1), module: m.id, title: t,
  video: yt(m.channelQ + " " + t),
  videoLabel: "Search " + m.source + " for this topic",
  reading: m.id === "speaking" ? "https://takeielts.britishcouncil.org/take-ielts/prepare" : "https://www.cambridgeenglish.org/exams-and-tests/ielts/preparation/",
  readingLabel: m.id === "speaking" ? "British Council IELTS preparation" : "Cambridge English IELTS preparation",
  alt: "https://ielts.idp.com/prepare/",
  altLabel: "IDP IELTS preparation hub",
  verified: false
}))}));

// MA in English (National University, Bangladesh).
// IMPORTANT: the official NU syllabus has NOT been verified in this build. The units below are a
// DRAFT scaffold of common literary areas, not the NU papers. Replace via the admin panel once the
// official syllabus (nu.ac.bd) is confirmed for the applicable session.
const MA_AREAS = [
 {id:"ma-poetry", name:"Poetry & Drama (draft area)", topics:["Reading verse: metre, figures and form","Renaissance drama: context and themes","Romantic poetry: context and themes","Modernist poetry: context and themes"]},
 {id:"ma-fiction", name:"Fiction (draft area)", topics:["Narrative technique and point of view","The Victorian novel","The modernist novel","Postcolonial fiction"]},
 {id:"ma-theory", name:"Criticism & Theory (draft area)", topics:["Classical and neoclassical criticism","Formalism and New Criticism","Marxist and feminist criticism","Postcolonial theory"]},
 {id:"ma-ling", name:"Language & Linguistics (draft area)", topics:["Phonetics and phonology","Syntax and morphology","Sociolinguistics","Academic writing for exams"]}
].map(a => ({...a, topics: a.topics.map((t, i) => ({id: a.id + "-" + (i + 1), module: a.id, title: t, draft: true}))}));

// CEFR placement. level: 1=A1 .. 5=C1 (weight = points)
const CEFR_QUESTIONS = [
 // Grammar
 {id:"q1",sec:"Grammar",lv:1,q:"She ___ a teacher.",o:["am","is","are","be"],a:1},
 {id:"q2",sec:"Grammar",lv:1,q:"We ___ to school every day.",o:["go","goes","going","gone"],a:0},
 {id:"q3",sec:"Grammar",lv:2,q:"I ___ TV when you called me.",o:["watch","watched","was watching","have watched"],a:2},
 {id:"q4",sec:"Grammar",lv:2,q:"He is taller ___ his brother.",o:["that","then","as","than"],a:3},
 {id:"q5",sec:"Grammar",lv:3,q:"If it ___ tomorrow, we will cancel the picnic.",o:["rains","will rain","rained","would rain"],a:0},
 {id:"q6",sec:"Grammar",lv:3,q:"I have lived here ___ 2019.",o:["for","since","during","from"],a:1},
 {id:"q7",sec:"Grammar",lv:4,q:"If I ___ you, I would accept the offer.",o:["am","was being","were","would be"],a:2},
 {id:"q8",sec:"Grammar",lv:4,q:"The report ___ by the time the manager arrived.",o:["had been finished","has finished","was finishing","finishes"],a:0},
 {id:"q9",sec:"Grammar",lv:5,q:"Hardly ___ the room when the lights went out.",o:["he had entered","had he entered","he entered","did he enter"],a:1},
 // Listening (spoken by browser speech; transcript available as fallback)
 {id:"l1",sec:"Listening",lv:1,audio:"Hello, my name is Anna. I live in London, and I work in a small bookshop.",q:"Where does Anna work?",o:["In a school","In a bookshop","In a hospital","In a bank"],a:1},
 {id:"l2",sec:"Listening",lv:2,audio:"The train to Manchester leaves at half past nine from platform four, not platform two as usual.",q:"Which platform does the train leave from?",o:["Platform two","Platform three","Platform four","Platform nine"],a:2},
 {id:"l3",sec:"Listening",lv:3,audio:"I was going to take the bus, but it was running late, so in the end I decided to walk, which actually turned out to be faster.",q:"Why did the speaker walk?",o:["The weather was nice","The bus was late","The bus was full","She likes walking"],a:1},
 {id:"l4",sec:"Listening",lv:4,audio:"Although the committee acknowledged the project's potential, it declined funding, arguing that the proposal underestimated the long-term maintenance costs.",q:"Why was funding refused?",o:["The project had no potential","The committee ran out of money","Maintenance costs were underestimated","The proposal was late"],a:2},
 // Reading
 {id:"r1",sec:"Reading",lv:1,passage:"Tom has a dog called Max. Every morning Tom takes Max to the park. Max likes to run and play with a red ball.",q:"What does Max like to play with?",o:["A red ball","A cat","A bone","A stick"],a:0},
 {id:"r2",sec:"Reading",lv:2,passage:"Tom has a dog called Max. Every morning Tom takes Max to the park. Max likes to run and play with a red ball.",q:"When does Tom take Max to the park?",o:["In the evening","At night","In the morning","At lunchtime"],a:2},
 {id:"r3",sec:"Reading",lv:3,passage:"Remote work has changed how companies hire. Employers can now recruit talent from anywhere, but they must also invest in tools that help distant teams communicate. Some workers report feeling isolated, while others enjoy the flexibility.",q:"What must employers do for distant teams?",o:["Reduce salaries","Invest in communication tools","Close their offices","Hire fewer workers"],a:1},
 {id:"r4",sec:"Reading",lv:4,passage:"Remote work has changed how companies hire. Employers can now recruit talent from anywhere, but they must also invest in tools that help distant teams communicate. Some workers report feeling isolated, while others enjoy the flexibility.",q:"The passage suggests that experiences of remote work are…",o:["uniformly positive","uniformly negative","mixed","irrelevant to employers"],a:2},
 {id:"r5",sec:"Reading",lv:5,passage:"The author's reluctance to commit to a single interpretation is not evasion but method: by letting contradictory readings stand side by side, the essay exposes how much any confident reading depends on what it chooses to ignore.",q:"What does the author's refusal to choose one interpretation achieve?",o:["It hides weak arguments","It reveals the selectivity behind confident readings","It proves all readings are equal","It shows the essay is unfinished"],a:1}
];
const CEFR_WRITING = {
  prompt: "Write 80–150 words: Describe a person who has influenced you and explain why. Use past and present tenses and link your ideas clearly.",
  minWords: 80
};
