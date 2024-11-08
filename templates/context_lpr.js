new Vue({
    el: '#app',
    data: {
      inputText: '',
      evaluation: false,
      steps: [],
      apiKey: '', // Enter your API key here or in the input field
  
       model: 'gpt-4o-mini', // Set your desired model here or in the input field
      stepConfigs: {
        'Data Collection': {
          definition: 'A data observer collects/stores data from data subjects.',
          maxScore: 20 // Adjusted maximum score
        },
        'Data Processing': {
          definition: 'A data observer processes users’ data to derive new data.',
          maxScore: 14
        },
        'Data Sharing': {
          definition: 'A data observer shares users’ data or derived data with another data stakeholder (i.e., observer, subject, and beneficiary/victim).',
          maxScore: 12
        },
        'Data Usage': {
          definition: 'A data observer uses the data in a certain way that impacts a data beneficiary/victim.',
          maxScore: 12
        },
      },
      questionsList: {
        'Data Collection': [
          'Who is the data observer?',
          'What is the data subject?',
          'What data are being collected/stored?',
          'Why is the company collecting/storing the data?',
          'How is the data being collected?',
          'Is the data collection anonymous, pseudo-anonymous, or non-anonymous?',
          'Do the users receive an explicit notification?',
          'How will the company keep the data?',
          'When will they delete the data?',
          'Do users receive compensation?'
        ],
        'Data Processing': [
          'Who is the observer?',
          'What are the raw data?',
          'What are the derived data?',
          'How are the data being processed?',
          'Is the processing anonymized?',
          'Who did the processing (algorithms or humans)?',
          'How is the processing method developed?'
        ],
        'Data Sharing': [
          'Who is the sender?',
          'Who is the recipient?',
          'Why does the sender share the data?',
          'How are the data being shared?',
          'Is the data sharing for profit?',
          'Is the process secure?'
        ],
        'Data Usage': [
          'Who is the observer?',
          'Who is the data beneficiary/victim?',
          'What are the potential risks (i.e., the probability and impact) for impacted users?',
          'Are users aware of such data usage?',
          'Does the company have users’ informed consent?',
          'Does the company give users compensation?'
        ]
      },
      questions: {},
      improvedText: '',
      selectedDimensions: [],
    },
    methods: {
      startEvaluation() {
        if (!this.apiKey) {
          alert('Please enter your API key first.');
          return;
        }
        this.evaluation = true;
        this.identifySteps();
      },
      identifySteps() {
        const steps = Object.keys(this.stepConfigs);
        const promises = steps.map(step => this.sendIdentifyRequest(step));
        Promise.all(promises).then(results => {
          this.steps = results.filter(result => result.isRelevant).map(result => result.step);
          this.selectedDimensions = [...this.steps]; // Initialize selected dimensions
          this.initializeQuestions();
          this.evaluateQuestions();
        });
      },
      sendIdentifyRequest(step) {
        const prompt = this.constructIdentifyPrompt(this.inputText, step);
        return fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.apiKey  // Use the apiKey variable
          },
          body: JSON.stringify({
            model: this.model,  // Use the model variable
            messages: prompt
          })
        })
          .then(response => response.json())
          .then(data => {
            const content = data.choices[0].message.content;
            const isRelevant = this.parseIdentifyResponse(content);
            return { step: step, isRelevant: isRelevant };
          })
          .catch(error => {
            console.error('Error:', error);
            return { step: step, isRelevant: false };
          });
      },
      constructIdentifyPrompt(text, step) {
        const definition = this.stepConfigs[step].definition;
        return [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: `Step 1:
  Identifying if the given text is related to the following data step.
  
  Data Step: ${step}
  Definition: ${definition}
  
  Text:
  "${text}"
  
  Answer 'Yes' if the text is related to ${step}, otherwise answer 'No'.`
          }
        ];
      },
      parseIdentifyResponse(responseText) {
        return responseText.trim().toLowerCase().startsWith('yes');
      },
      initializeQuestions() {
        this.steps.forEach(step => {
          this.$set(this.questions, step, this.questionsList[step].map(question => ({
            question: question,
            score: null,
            attitude: 'unknown',
            loading: true,
            answer: null,
          })));
        });
      },
      evaluateQuestions() {
        this.steps.forEach(step => {
          this.questions[step].forEach((questionObj, index) => {
            this.sendEvaluateRequest(step, questionObj, index);
          });
        });
      },
      sendEvaluateRequest(step, questionObj, index) {
        const prompt = this.constructEvaluatePrompt(this.inputText, questionObj.question);
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.apiKey  // Use the apiKey variable
          },
          body: JSON.stringify({
            model: this.model,  // Use the model variable
            messages: prompt
          })
        })
          .then(response => response.json())
          .then(data => {
            const content = data.choices[0].message.content;
            const { score, answer } = this.parseEvaluateResponse(content);
            questionObj.score = score;
            questionObj.answer = answer;
            if (score < 2) {
              this.inferAttitude(step, questionObj);
            } else {
              questionObj.loading = false;
            }
          })
          .catch(error => {
            console.error('Error:', error);
            questionObj.score = 0;
            questionObj.loading = false;
          });
      },
      constructEvaluatePrompt(text, question) {
        return [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: `Step 3:
  Check if the given text includes the following description:
  
  Question:
  ${question}
  
  Text:
  "${text}"
  
  Scoring Criteria:
  Assign a score of 0, 1, or 2 based on the following standards:
  0: The text does not provide any relevant information.
  1: The text includes related information that allows for reasonable inference.
  2: The text explicitly states the information, leaving no room for ambiguity.
  
  Provide your answer in the following format:
  
  Score: [0-2]
  Answer: [Your extracted or inferred answer based on the text]`
          }
        ];
      },
      parseEvaluateResponse(responseText) {
        let score = 0;
        let answer = '';
        const scoreMatch = responseText.match(/Score:\s*(\d)/i);
        if (scoreMatch) {
          score = parseInt(scoreMatch[1]);
        }
        const answerMatch = responseText.match(/Answer:\s*([\s\S]*)/i);
        if (answerMatch) {
          answer = answerMatch[1].trim();
        }
        return { score, answer };
      },
      inferAttitude(step, questionObj) {
        const prompt = this.constructInferPrompt(questionObj.question, this.inputText);
        console.log(prompt);
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.apiKey  // Use the apiKey variable
          },
          body: JSON.stringify({
            model: this.model,  // Use the model variable
            messages: prompt
          })
        })
          .then(response => response.json())
          .then(data => {
            const content = data.choices[0].message.content;
            const attitude = this.parseInferResponse(content);
            questionObj.attitude = attitude;
            questionObj.loading = false;
          })
          .catch(error => {
            console.error('Error:', error);
            questionObj.attitude = 'unknown';
            questionObj.loading = false;
          });
      },
      constructInferPrompt(question, text) {
        return [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: `Step 4:
  For the following question, infer the likely attitude if it were mentioned in the text, even if it is not explicitly stated.
  
  Question:
  ${question}
  
  Context:
  "${text}"
  
  Possible attitudes: positive, negative, neutral, unknown.
  
  Provide the inferred attitude.
  Answer the question #### positive, negative, neutral, or unknown.`
          }
        ];
      },
      parseInferResponse(responseText) {
        const cleanedText = responseText.trim().toLowerCase();
        const match = cleanedText.match(/\b(positive|negative|neutral|unknown)\b/);
  
        if (match) {
          return match[0];
        }
        
        return 'unknown';
      },
      getDimensionScore(step) {
        const totalScore = this.questions[step].reduce((sum, q) => sum + q.score, 0);
        const maxScore = this.stepConfigs[step].maxScore;
        return `${totalScore}/${maxScore}`;
      },
      getDimensionRating(step) {
        const totalScore = this.questions[step].reduce((sum, q) => sum + q.score, 0);
        const maxScore = this.stepConfigs[step].maxScore;
        const percentage = (totalScore / maxScore) * 100;
        if (percentage <= 20) return 'Extremely Low';
        if (percentage <= 40) return 'Low';
        if (percentage <= 60) return 'Medium';
        if (percentage <= 80) return 'High';
        return 'Extremely High';
      },
      getDimensionScoreClass(step) {
        const rating = this.getDimensionRating(step);
        if (['Extremely Low', 'Low'].includes(rating)) return 'low-score';
        if (rating === 'Medium') return 'medium-score';
        return 'high-score';
      },
      requestImprovement() {
        if (this.selectedDimensions.length === 0) {
          alert('Please select at least one dimension to improve.');
          return;
        }
        this.improvedText = ''; // Reset previous improved text
        this.improveOriginalText();
      },
      improveOriginalText() {
        const prompt = this.constructImprovePrompt();
        console.log(prompt);
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.apiKey  // Use the apiKey variable
          },
          body: JSON.stringify({
            model: this.model,  // Use the model variable
            messages: prompt
          })
        })
          .then(response => response.json())
          .then(data => {
            this.improvedText = data.choices[0].message.content.trim();
          })
          .catch(error => {
            console.error('Error:', error);
            this.improvedText = 'Error improving text.';
          });
      },
      constructImprovePrompt() {
        let feedback = '';
        this.selectedDimensions.forEach(step => {
          const totalScore = this.questions[step].reduce((sum, q) => sum + q.score, 0);
          const maxScore = this.stepConfigs[step].maxScore;
          const dimensionRating = this.getDimensionRating(step);
          feedback += `Dimension: ${step}\nScore: ${totalScore}/${maxScore} - ${dimensionRating}\n`;
          this.questions[step].forEach(questionObj => {
            if (questionObj.score < 2 & questionObj.attitude !== 'unknown') {
              feedback += `Question: ${questionObj.question}\nAttitude: ${questionObj.attitude}\n Score: ${questionObj.score}\n`;
            }
          });
          feedback += '\n';
        });
        return [
          {
            role: 'system',
            content: 'You are a helpful assistant focusing on improving evaluations.'
          },
          {
            role: 'user',
            content: `Based on the contextual completeness feedback, improve the Text Description, try to make it more complete and can get a better completeness score.
  
  Feedback:
  ${feedback}
  Dimensions to improve: ${this.selectedDimensions.join(', ')}
  Original Text:
  "${this.inputText}"
  
  Provide a refined text that reflects the improvements, focusing on clarity and completeness specifically relevant to the context and selected dimensions. This is not a task of adding keywords or making broad assumptions; aim to logically structure the description based on the context without over-interpreting.
  
  Guidelines:
  
  - **Relevance**: Only address the dimensions that are directly necessary based on the feedback and context provided. Avoid adding information that is not clearly implied or required for understanding.
  - **Grounded Inferences**: Make inferences only when they are logically supported by the context. Postive means that you can infer the missing content in a positive way, negative means that you can infer the missing content in a negative way, and neutral means that you can infer the content in a neutral way.
  - **Avoid Over-Explanation**: Be concise and avoid adding excessive detail that could misinterpret the intended context. The goal is to enhance clarity without overloading the description with unsupported information.
  
  **IMPORTANT**:
  
  - Focus only on the selected dimensions: ${this.selectedDimensions.join(', ')}.
  - Only return the improved text.`
          }
        ];
      }
    }
  });
  