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

        const prompt = `너는 한국어 UX 라이터야. 아래 원문을 5가지 스타일로 다시 써줘.

[절대 규칙]
- 원문의 모든 정보와 의미를 빠짐없이 유지할 것 (내용 삭제 금지)
- 원문에 없는 감탄사, 설명, 추가 문장 넣지 말 것
- UX Writing 원칙 적용: 능동형, 쉬운 말, 긍정형 표현 선호
- 자연스러운 한국어 어순을 반드시 지킬 것 (번역투, 어색한 문장 금지)

원본: "${text}"

[스타일별 규칙]
1. friendly (친절):
   - 해요체 사용
   - 딱딱한 표현 → 부드럽게 (예: "불가합니다" → "어려워요")
   - 부정형 → 가능한 긍정형으로 (예: "안 됩니다" → "이렇게 하면 돼요")
   - 수동형 → 능동형으로 (예: "처리되었습니다" → "처리했어요")

2. casual (캐주얼):
   - 가벼운 해요체 사용 (반말 금지, 과하게 친근한 표현 금지)
   - friendly보다 약간 더 가볍고 짧은 정도
   - 불필요한 높임말 제거, 자연스럽게
   - 예: "확인해 주시기 바랍니다" → "확인해보세요"

3. polite (정중):
   - 일반적인 합쇼체/습니다체
   - 전문적이고 신뢰감 있게
   - 삼성·네이버 앱 수준의 표준 서비스 톤

4. formal (경어):
   - 공식 문서 스타일 합쇼체
   - "~해 주시기 바랍니다" 형태
   - 은행·공공기관 수준의 격식체

5. keyword (단어형):
   - 핵심 명사/동사만 남김
   - 조사·어미 제거
   - 2~4단어로 압축
   - 버튼 레이블·태그에 쓸 수 있는 형태

[예시] 원문: "로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요."
- friendly: "아이디나 비밀번호가 맞지 않아요. 다시 확인해볼게요?"
- casual: "로그인 정보가 틀렸어요. 아이디와 비밀번호를 확인해요"
- polite: "로그인에 실패했습니다. 아이디와 비밀번호를 다시 확인해 주세요."
- formal: "로그인에 실패하였습니다. 아이디와 비밀번호를 확인해 주시기 바랍니다."
- keyword: "로그인 실패 · 정보 확인"

JSON만 반환:
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
