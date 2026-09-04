import React from 'react'
import type { CoverLetter, CVBasics } from '../../types/cv'

export const DEFAULT_SAMPLE_COVER_LETTER: CoverLetter = {
  recipient: {
    name: 'Dr. Roberto William',
    title: 'Diretor de Engenharia & Contratação',
    company: 'Tech Global Innovations Inc.',
    address: 'Av. Faria Lima, 3500 - São Paulo, SP'
  },
  date: '31 de Agosto de 2026',
  subject: 'Candidatura: Posição de Staff Software Architect & Lead de IA',
  salutation: 'Prezado Dr. Roberto William e comitê de seleção,',
  paragraphs: [
    'Acompanho com grande admiração a liderança da Tech Global Innovations no desenvolvimento de sistemas autônomos de alta confiabilidade. Com mais de 8 anos de experiência sólida em arquitetura de microsserviços distribuídos, engenharia de inteligência artificial e liderança de squads técnicas multidisciplinares, vejo uma sinergia ímpar entre os meus resultados e os desafios estratégicos da sua organização.',
    'Na minha atuação recente como Staff Architect na Enterprise Tech Solutions, fui o responsável direto por desenhar a migração de nossa infraestrutura central para microsserviços event-driven, sustentando mais de 2 milhões de transações diárias com redução de 45% na latência p99. Adicionalmente, estruturei nossos primeiros pipelines corporativos de IA generativa, integrando guardrails de segurança e otimização de cache que cortaram os custos de inferência em 60%.',
    'Acredito firmemente que a excelência arquitetural deve sempre caminhar junto com a governança prática e a autonomia das equipes. Minha missão é traduzir visões de negócio ambiciosas em sistemas robustos, seguros e escaláveis que entreguem valor tangível de ponta a ponta.',
    'Agradeço sinceramente a atenção e coloco-me à disposição para um diálogo aprofundado sobre como posso alavancar os objetivos técnicos e de expansão da Tech Global Innovations neste ano.'
  ],
  closing: 'Atenciosamente,',
  signature: 'Alexandre Silva'
}

interface BlockCoverLetterProps {
  coverLetter?: CoverLetter
  basics: CVBasics
  onRequestGenerate?: () => void
}

export const BlockCoverLetter: React.FC<BlockCoverLetterProps> = ({
  coverLetter,
  basics,
  onRequestGenerate: _onRequestGenerate
}) => {
  const letter = coverLetter || DEFAULT_SAMPLE_COVER_LETTER
  const { date, subject, salutation, closing, signature, signatureImage } = letter
  const rawRecipient = letter.recipient
  const recipient = typeof rawRecipient === 'string'
    ? { name: rawRecipient, company: letter.company }
    : (rawRecipient ? { ...rawRecipient, company: rawRecipient.company || letter.company } : undefined)
  const paragraphs = letter.paragraphs && letter.paragraphs.length > 0
    ? letter.paragraphs
    : (letter.body ? letter.body.split('\n\n').map(p => p.trim()).filter(Boolean) : [])

  return (
    <article className="cv-cover-letter-body cv-section-cover_letter">
      {recipient && (
        <div className="cv-cover-recipient">
          {recipient.name && <div className="cv-cover-recipient-name">{recipient.name}</div>}
          {recipient.title && <div className="cv-cover-recipient-title">{recipient.title}</div>}
          {recipient.company && <div className="cv-cover-recipient-company">{recipient.company}</div>}
          {recipient.address && <div className="cv-cover-recipient-address">{recipient.address}</div>}
        </div>
      )}

      {date && <div className="cv-cover-date">{date}</div>}
      {subject && <div className="cv-cover-subject"><strong>Assunto:</strong> {subject}</div>}
      {salutation && <div className="cv-cover-salutation">{salutation}</div>}

      <div className="cv-cover-paragraphs">
        {paragraphs && paragraphs.map((para, idx) => (
          <p key={idx} className="cv-cover-para">{para}</p>
        ))}
      </div>

      <div className="cv-cover-closing-block">
        <div className="cv-cover-closing">{closing || 'Atenciosamente,'}</div>
        {signatureImage && (
          <div className="cv-cover-sig-image-wrap">
            <img src={signatureImage} alt="Assinatura" className="cv-cover-sig-image" />
          </div>
        )}
        <div className="cv-cover-signature">{signature || basics.name}</div>
        {basics.label && <div className="cv-cover-signer-label">{basics.label}</div>}
      </div>
    </article>
  )
}
