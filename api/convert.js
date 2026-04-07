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
- 자연스러운 한국어 어순을 지킬 것 (번역투 금지)
- 핵심 정보를 문장 앞에 배치할 것
- 한 문장에 하나의 정보만 담을 것

[공통 UX Writing 원칙]
- 능동형 우선: '처리되었습니다' → '처리했어요', '됐어요' → '했어요'
- 긍정형 우선: '할 수 없어요' → '이렇게 하면 돼요' (단, 정책상 불가 시 부정형 허용)
- 한자어 명사 나열 → 동사형으로 풀어쓰기: '본인인증 진행 중' → '본인인지 확인하고 있어요'
- 맞춤법: '돼요' 사용 ('되어요' 금지), '안 돼요' (띄어쓰기)
- 권장 용어: 로그인(접속×), 비밀번호(패스워드×), 알림(통지×), 설정(세팅×), 취소(닫기×)
- 에러 메시지는 [문제 상황 + 해결 방법] 구조로

[스타일별 규칙]
1. friendly (친절):
   - 해요체, 문장 끝 마침표 포함
   - 수동형 → 능동형, 부정형 → 긍정형
   - 과도한 경어 축소: '계신' → '있는', '어느' → '어떤', '님께' → '에게'
   - 한자어 명사 → 동사형 풀어쓰기
   - 성공 메시지에만 '!' 사용 가능

2. casual (캐주얼):
   - 가벼운 해요체 (반말 금지, 과한 친근감 금지)
   - friendly보다 짧고 군더더기 없게
   - 불필요한 높임말 제거: '확인해 주시기 바랍니다' → '확인해보세요'
   - 한자어 → 쉬운 말로: '오류' → '문제', '완료' → '됐어요'
   - '돼요' 맞춤법 적용

3. polite (정중):
   - 합니다/습니다체
   - 삼성·네이버 앱 수준의 표준 서비스 톤
   - 전문적이고 신뢰감 있게, 군더더기 없이

4. formal (경어):
   - 공식 합쇼체, '~해 주시기 바랍니다' 형태
   - 은행·공공기관 수준의 격식체
   - 수동형 허용 (주어 강조 필요 시)

5. keyword (단어형):
   - 핵심 명사/동사만, 조사·어미 제거
   - 2~4단어로 압축
   - 마침표 없음, 버튼 레이블·태그 형태

[예시] 원문: "로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요."
- friendly: "비밀번호나 아이디가 맞지 않아요. 다시 확인해볼게요?"
- casual: "로그인 정보가 틀렸어요. 아이디와 비밀번호를 확인해보세요."
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
