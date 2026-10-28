import { ArrowRight, Fish, Globe2, MapPin, MessageCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import { Card } from './Card'

export type CommunityPostCardProps = {
  name: string
  initials: string
  color: string
  time: string
  text: string
  image: 'lagoon' | 'boat'
}

export function CommunityPostCard({ name, initials, color, time, text, image }: CommunityPostCardProps) {
  return <Card as="article" className="post-card">
    <div className="post-head"><Avatar initials={initials} tone={color}/><div className="post-author"><strong>{name}</strong><span>{time} · <Globe2 size={12}/> Pubblico</span></div><button className="more-button" aria-label="Altre opzioni">···</button></div>
    <p>{text}</p>
    <div className={`post-image ${image}`}><span className="image-caption"><MapPin size={13}/>{image === 'lagoon' ? 'Burano, Laguna nord' : 'Laguna di Venezia'}</span><span className="image-sun"/></div>
    <div className="post-actions"><button><Fish size={16}/> 24</button><button><MessageCircle size={16}/> 6 commenti</button><button className="share-action"><ArrowRight size={16}/> Condividi</button></div>
  </Card>
}
