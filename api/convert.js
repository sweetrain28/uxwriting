module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: '텍스트가 비어있습니다' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API 키 설정 오류' });
        }

        const prompt = `너는 한국어 UX 라이터야. 아래 텍스트를 5가지 스타일로 변환해줘.

핵심 규칙:
- 원문의 의미와 정보를 그대로 유지할 것
- 원문에 없는 내용, 설명, 감탄사, 추가 문장은 절대 넣지 말 것
- 스타일만 바꿀 것. 내용을 늘리지 말 것

원본 텍스트: "${text}"

스타일 정의:
1. friendly: 따뜻하고 부드러운 해요체. 딱딱한 표현만 부드럽게 바꿈. 내용 추가 금지.
2. casual: 가볍고 자연스러운 해요체. 반말 금지. 토스 앱처럼 짧고 자연스럽게.
3. polite: 일반적인 서비스 존댓말. 군더더기 없이 깔끔하게.
4. formal: 공식적인 경어체. 기업 공지문 스타일. 간결하게.
5. keyword: 핵심 명사만 남김. 조사/서술어 제거. 2~5단어로 압축.

예시 (원문: "비밀번호가 틀렸습니다"):
- friendly: "비밀번호가 맞지 않아요"
- casual: "비밀번호가 틀렸어요"
- polite: "비밀번호가 일치하지 않습니다"
- formal: "비밀번호가 일치하지 않습니다. 다시 확인해 주시기 바랍니다"
- keyword: "비밀번호 오류"

JSON만 반환 (다른 텍스트 없이):
{
  "friendly": "변환된 텍스트",
  "casual": "변환된 텍스트",
  "polite": "변환된 텍스트",
  "formal": "변환된 텍스트",
  "keyword": "변환된 텍스트"
}`;

        const groqRes = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7
                })
            }
        );

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('Groq API 오류:', errText);
            throw new Error(`Groq API 오류: ${groqRes.status}`);
        }

        const groqData = await groqRes.json();
        const responseText = groqData.choices?.[0]?.message?.content || '';

        let parsedResult;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('JSON을 찾을 수 없음');
            parsedResult = JSON.parse(jsonMatch[0]);
        } catch (e) {
            parsedResult = { friendly: text, casual: text, polite: text, formal: text, keyword: text };
        }

        res.status(200).json(parsedResult);

    } catch (error) {
        console.error('변환 오류:', error);
        res.status(500).json({ error: error.message || '변환 중 오류가 발생했습니다' });
    }
};
