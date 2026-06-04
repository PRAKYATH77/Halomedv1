import { answerCustomerQuestion } from '../src/utils/customerAssistant.js';

const message = process.argv.slice(2).join(' ') || 'How do I track my delivery?';
const result = await answerCustomerQuestion(message, []);

console.log(JSON.stringify(result, null, 2));

