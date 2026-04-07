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
        const { text, mode } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: '텍스트가 비어있습니다' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API 키 설정 오류' });
        }

        const prompt = mode === 'toss' ? getTossPrompt(text) : mode === 'sinhan' ? getSinhanPrompt(text) : getKbPrompt(text);

        const groqRes = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
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
            if (mode === 'toss') {
                parsedResult = { toss: text };
            } else if (mode === 'sinhan') {
                parsedResult = { sinhan: text };
            } else {
                parsedResult = { hapsyo: text, haeyo: text, noun: text, banmal: text };
            }
        }

        res.status(200).json(parsedResult);

    } catch (error) {
        console.error('변환 오류:', error);
        res.status(500).json({ error: error.message || '변환 중 오류가 발생했습니다' });
    }
};

function getKbPrompt(text) {
    return `너는 KB국민은행 UX 라이터야. 아래 원문을 KB 고객언어 가이드에 따라 4가지 말투로 다시 써줘.

[절대 규칙]
- 원문의 모든 정보와 의미를 빠짐없이 유지할 것 (내용 삭제 금지)
- 원문에 없는 감탄사, 설명, 추가 문장 넣지 말 것
- 자연스러운 한국어 어순을 지킬 것 (번역투 금지)

[KB 공통 원칙]
- 능동문 우선: '완료되었습니다' → '완료했습니다', '발송되었습니다' → '도착했습니다'
- '-시'는 마지막 서술어에 한 번만 사용 (과도한 높임 금지)
- 과도한 높임 제거: '-하셔서' → '-해서', '-하오니' → '-하니'
- 한자 직접 표기 금지: '後' → '후', '中' → '중', '外' → '외'
- 번역투 제거: '-을 가진' → '-이 있으면', '-에 대해' → '-를', '-을 통해' → '-에서'
- 중복·군더더기 제거: '-완료', '-진행', '-처리', '-건', '-들' 등
- 금융용어 → 쉬운 말: '내점' → '방문', '익월' → '다음 달', '평잔' → '평균 잔액'

원본: "${text}"

[말투별 규칙]
1. hapsyo (하십시오체):
   - 합니다/입니다/니다 어미 사용
   - 격식체, 정중하고 진지한 톤
   - 공지·정책 안내·유의사항·약관 스타일
   - 예: "최종 한도는 신용평가 결과에 따라 달라질 수 있습니다."

2. haeyo (해요체):
   - 해요/세요/요 어미 사용
   - 비격식체, 친근하고 적극적인 톤
   - 마케팅·행동 유도·복잡한 내용 쉽게 안내할 때
   - 예: "더 낮은 금리로 갈아타세요."

3. noun (명사형):
   - -하기/-기/-음/-함 형태로 마무리
   - 제목·배너·버튼 레이블에 쓸 수 있는 간결한 형태
   - 조사·어미 최소화, 핵심 행동/정보만 남김
   - 예: "금리 낮추기", "한도 조회하기"

4. banmal (반말):
   - -하자!/-할까?/-란?/-다! 형태
   - 고객 1인칭 시점에서 쓰는 경쾌한 말투
   - 호기심 유발·제안·감탄 상황에 적합
   - 무례하거나 공격적인 표현 금지
   - 예: "내 한도 얼마나 될까?", "이자 줄이고 여유 찾자!"

[예시] 원문: "이중납부된 경우 환급을 신청하시기 바랍니다."
- hapsyo: "이중납부된 경우, 환급을 신청하시기 바랍니다."
- haeyo: "이중납부됐다면 환급을 신청하세요."
- noun: "이중납부 환급 신청하기"
- banmal: "이중납부됐다면 환급받자!"

JSON만 반환:
{
  "hapsyo": "변환된 텍스트",
  "haeyo": "변환된 텍스트",
  "noun": "변환된 텍스트",
  "banmal": "변환된 텍스트"
}`;
}

function getSinhanPrompt(text) {
    return `너는 신한카드 UX 라이터야. 아래 원문을 신한카드 UX Writing 가이드에 따라 다시 써줘.

[절대 규칙]
- 원문의 모든 정보와 의미를 빠짐없이 유지할 것 (내용 삭제 금지)
- 원문에 없는 감탄사, 설명, 추가 문장 넣지 말 것
- 자연스러운 한국어 어순을 지킬 것 (번역투 금지)

[신한카드 UX Writing 원칙]
1. 문체: 하십시오체(~합니다) 기본, 행동 유도 시 해요체(~하세요/~해보세요) 병용 가능
2. 과도한 높임말 제거:
   - '~하시면 ~하실 수 있습니다' → '~하면 ~할 수 있습니다' (주어 없는 안내)
   - '-시' 중복 사용 금지
3. 긍정형 우선:
   - '불가', '불가능' → '할 수 없습니다'
   - '~이 안 된다' → '이렇게 해보세요' 또는 긍정형으로
   - 단, 명확한 부정 안내가 필요한 경우 예외
4. 짧고 간결하게:
   - 군더더기 제거: '정말', '참', '매우' 등 부사어 삭제
   - '~처리', '~적용', '~완료' 등 서술어 덧붙임 제거
   - '비밀번호 변경이 완료되었습니다' → '비밀번호가 변경되었습니다'
5. 전문·내부 용어 → 쉬운 말:
   - '내점/내방' → '방문', '상이하다' → '다르다', '익일/익월' → '다음날/다음달'
   - '통보/통지' → '알림', '구비서류' → '준비서류', '절사' → '끊어서 계산'
6. 번역투 제거:
   - '~를 통해/통하여' → '~에서'
   - '~에 있어서' → 삭제
   - '~적(的)으로' → 삭제 또는 쉬운 표현으로
7. 핵심 정보 앞에 배치, 한 문장에 하나의 정보

원본: "${text}"

[예시]
원문: "필수약관 미동의시 사용이 불가합니다."
→ "필수약관은 반드시 동의해야 합니다."

원문: "간편비밀번호를 등록하시면 편리하게 이용하실 수 있습니다."
→ "간편비밀번호를 등록하고 편리하게 이용해보세요."

JSON만 반환:
{
  "sinhan": "변환된 텍스트"
}`;
}

function getTossPrompt(text) {
    return `너는 토스 UX 라이터야. 아래 원문을 토스 UX 라이팅 가이드에 따라 다시 써줘.

[절대 규칙]
- 원문의 모든 정보와 의미를 빠짐없이 유지할 것 (내용 삭제 금지)
- 원문에 없는 감탄사, 설명, 추가 문장 넣지 말 것
- 자연스러운 한국어 어순을 지킬 것 (번역투 금지)

[토스 UX 라이팅 원칙]
1. 해요체 사용: 상황·맥락 불문하고 모든 문구에 해요체 적용
2. 능동형 우선:
   - '됐어요' → '했어요' (수동 → 능동)
   - '~었' 표현 → 현재형 능동으로
   - '처리되었습니다' → '처리했어요'
3. 긍정형 우선:
   - '안 돼요/없어요' → '~하면 돼요/있어요'
   - 에러 메시지: 문제 상황 + 해결 방법을 긍정형으로
   - 단, 정책상 불가능하거나 명확히 부정 안내가 필요한 경우 예외
4. 캐주얼한 경어 (과도한 경어 금지):
   - 동사에서 '~시' 빼기: '사용하시면' → '사용하면'
   - '계시다' → '있다'
   - '여쭈다' → '확인하다/묻다'
   - '께' → '에게'
   - 단, 사용자 맥락 질문('혹시 ~하셨나요?')이나 선의 요청 시 경어 허용
5. 명사+명사 나열 금지 → 동사형으로 풀어쓰기:
   - '본인인증 진행 중' → '본인인지 확인하고 있어요'
   - '{A}가 {B}해서' 형태로 풀기
6. '돼요' 사용 ('되어요' 금지)

원본: "${text}"

[예시]
원문: "계좌이체가 불가능합니다. 잔액을 확인해 주시기 바랍니다."
→ "계좌를 이체할 수 없어요. 잔액을 확인해보세요."

원문: "본인인증이 완료되었습니다."
→ "본인인지 확인했어요."

JSON만 반환:
{
  "toss": "변환된 텍스트"
}`;
}
