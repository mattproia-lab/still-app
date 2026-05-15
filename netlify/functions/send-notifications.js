// netlify/functions/send-notifications.js
// Runs daily — checks inactive users and sends re-engagement push notifications
// Schedule: every day at 9pm ET (configure in netlify.toml)

const ONESIGNAL_APP_ID = '19eccbcf-5a1f-42ba-a23c-54726795a751';
const SUPA_URL = 'https://zbskapivansfewegllnz.supabase.co';

// Full 24-week notification series
const SERIES = [
  // WEEK 1: The Call to Stillness — Amma Sophia
  { week:1, day:1, quote:"Sit in your cell, and your cell will teach you everything.", source:"Abba Moses", message:"Beloved, return today. The desert waits for you in the quiet." },
  { week:1, day:2, quote:"Be at peace with your soul, and heaven and earth will be at peace with you.", source:"Abba Anthony", message:"Come back, child. Peace is only one still moment away." },
  { week:1, day:3, quote:"Silence is the beginning of all prayer.", source:"Abba Pambo", message:"The silence is ready. Will you enter it today?" },
  { week:1, day:4, quote:"Go, sit in your cell, and your cell will teach you.", source:"Abba Arsenius", message:"Return to the place of prayer. I am here waiting for you." },
  { week:1, day:5, quote:"In stillness the soul finds its true home.", source:"Amma Syncletica", message:"Come home, dear one. Stillness calls you gently." },
  { week:1, day:6, quote:"The one who prays in secret is heard in the open.", source:"Abba John the Dwarf", message:"Pray in secret today. Heaven is listening." },
  { week:1, day:7, quote:"Keep the stillness and the stillness will keep you.", source:"Desert saying", message:"The week begins again in quiet. Come, let us pray." },
  // WEEK 2: The Prayer of the Heart
  { week:2, day:1, quote:"Prayer is the ascent of the mind to God.", source:"Evagrius Ponticus", message:"Lift your heart once more. I am waiting for you here." },
  { week:2, day:2, quote:"Lord Jesus Christ, have mercy on me.", source:"The Jesus Prayer", message:"Speak His name again today. I will pray with you." },
  { week:2, day:3, quote:"Pray without ceasing.", source:"Abba Macarius", message:"Even five minutes returns you to the flow of ceaseless prayer." },
  { week:2, day:4, quote:"Tears of compunction open the heart.", source:"Abba Poemen", message:"Let the heart soften today. Return and let it be opened." },
  { week:2, day:5, quote:"The prayer of one who is quiet is like a spear in battle.", source:"Amma Theodora", message:"Take up the spear of prayer again, beloved." },
  { week:2, day:6, quote:"Breathe God in, breathe God out.", source:"Desert tradition", message:"Come breathe with me today. One breath is enough to begin." },
  { week:2, day:7, quote:"The heart is a garden. Prayer is the water.", source:"Abba Isaiah", message:"Your heart is thirsty. Come water it." },
  // WEEK 3: Humility & Self-Knowledge
  { week:3, day:1, quote:"I am not yet a monk, but I have seen one.", source:"Abba Sisoes", message:"Return in humility. That is enough. That has always been enough." },
  { week:3, day:2, quote:"Come as you are. The desert receives the lowly.", source:"Desert tradition", message:"You do not need to be ready. Come as you are." },
  { week:3, day:3, quote:"The beginning of salvation is the knowledge of our sin.", source:"Abba Anthony", message:"Do not fear your weakness. Come back with it." },
  { week:3, day:4, quote:"If you see a brother sin, cover him with mercy.", source:"Abba Poemen", message:"Cover your own soul with mercy today." },
  { week:3, day:5, quote:"Humility is the ladder to heaven.", source:"John Climacus", message:"Take one step back into prayer. The ladder is here." },
  { week:3, day:6, quote:"Die to yourself daily.", source:"Desert Fathers", message:"Return and die a little more to the noise." },
  { week:3, day:7, quote:"The humble man is never disturbed.", source:"Abba Pambo", message:"Find undisturbed peace again today." },
  // WEEK 4: Solitude & the Inner Cell
  { week:4, day:1, quote:"Go into your inner room and shut the door.", source:"Abba Arsenius", message:"Close the door to the world for a moment. I am here." },
  { week:4, day:2, quote:"In solitude God speaks.", source:"Amma Syncletica", message:"Come to the place of solitude. He is speaking." },
  { week:4, day:3, quote:"Flee, be silent, pray always.", source:"Abba Arsenius", message:"Flee here. Be silent here. Pray here." },
  { week:4, day:4, quote:"The monk out of his cell is like a fish out of water.", source:"Abba Anthony", message:"Return to your cell, beloved. You were made for this water." },
  { week:4, day:5, quote:"Solitude is the mother of prayer.", source:"Evagrius", message:"Come home to your Mother." },
  { week:4, day:6, quote:"Stay in your cell and it will teach you.", source:"Abba Moses", message:"The cell is still open. Come learn." },
  { week:4, day:7, quote:"In the desert the soul meets her Bridegroom.", source:"Desert tradition", message:"The Bridegroom waits. Will you meet Him again today?" },
  // WEEK 5-24 abbreviated for function size — full series in notifications.js
  { week:5, day:1, quote:"Watch over your heart with all diligence.", source:"Proverbs 4:23", message:"The heart needs tending. Come tend it today." },
  { week:5, day:2, quote:"Keep watch at the door of your heart.", source:"Abba Poemen", message:"Who has been entering while you were away? Come watch with me." },
  { week:5, day:3, quote:"The vigilant soul is never taken by surprise.", source:"Evagrius", message:"Return to vigilance. The desert teaches it." },
  { week:5, day:4, quote:"Sobriety is the guardian of prayer.", source:"Abba Isaiah", message:"Be sober today. Be watchful. Come pray." },
  { week:5, day:5, quote:"A small fire warms the soul. Neglect extinguishes it.", source:"Desert saying", message:"Come tend the fire before it dims entirely." },
  { week:5, day:6, quote:"The eye that watches inward sees the kingdom.", source:"Desert tradition", message:"Turn the eye inward today. I will sit with you." },
  { week:5, day:7, quote:"Blessed is the one who guards his heart in silence.", source:"Amma Syncletica", message:"Guard your heart in silence today, beloved." },
  { week:6, day:1, quote:"Resist the devil and he will flee from you.", source:"James 4:7", message:"Come arm yourself in prayer today." },
  { week:6, day:2, quote:"The demon fears nothing so much as prayer.", source:"Abba Macarius", message:"Return and pray. That is enough to scatter the darkness." },
  { week:6, day:3, quote:"Do not yield to small temptations lest you fall into greater ones.", source:"Abba Poemen", message:"Do not wait any longer. Come back now." },
  { week:6, day:4, quote:"When tempted, do not argue. Pray.", source:"Desert Fathers", message:"Stop arguing with the noise. Come pray instead." },
  { week:6, day:5, quote:"The one who flees temptation is stronger than one who overcomes it.", source:"Abba John the Dwarf", message:"Flee here. This is the place of refuge." },
  { week:6, day:6, quote:"Humility alone defeats pride.", source:"Desert tradition", message:"Come in humility today. That is the only weapon needed." },
  { week:6, day:7, quote:"Every trial is a school of the heart.", source:"Amma Theodora", message:"The school is open. The lesson is waiting." },
  { week:7, day:1, quote:"Blessed are those who mourn, for they shall be comforted.", source:"Matthew 5:4", message:"Bring what needs mourning. Comfort is here." },
  { week:7, day:2, quote:"The gift of tears is the beginning of new life.", source:"Abba Poemen", message:"Let the heart weep today if it needs to. I am not afraid of your tears." },
  { week:7, day:3, quote:"Repentance is not punishment. It is return.", source:"Desert tradition", message:"Return today. That is all repentance asks of you." },
  { week:7, day:4, quote:"A broken and contrite heart, O God, you will not despise.", source:"Psalm 51:17", message:"Come broken if you must. He does not despise it." },
  { week:7, day:5, quote:"Weep for your sins and God will wipe every tear.", source:"Abba Moses", message:"Every tear is seen. Every return is received." },
  { week:7, day:6, quote:"The father ran to meet the son while he was still far off.", source:"Luke 15:20", message:"He is already running toward you. Will you take one step?" },
  { week:7, day:7, quote:"Do not despair. The desert has seen darker souls than yours find light.", source:"Amma Syncletica", message:"Do not despair. Come back. The light is still here." },
  { week:8, day:1, quote:"Love never fails.", source:"1 Corinthians 13:8", message:"Love has not failed you. Come receive it." },
  { week:8, day:2, quote:"He who loves God loves his neighbor.", source:"Abba Anthony", message:"Return to love today. It begins in stillness." },
  { week:8, day:3, quote:"Mercy triumphs over judgment.", source:"James 2:13", message:"Come under mercy today. It is wide enough for you." },
  { week:8, day:4, quote:"Love your enemies and pray for those who persecute you.", source:"Matthew 5:44", message:"The hardest prayers are the most freeing. Come pray them." },
  { week:8, day:5, quote:"Bear one another's burdens and so fulfill the law of Christ.", source:"Galatians 6:2", message:"Lay your burden down here. We will carry it together." },
  { week:8, day:6, quote:"The measure of love is to love without measure.", source:"St. Bernard", message:"Come be loved without measure today." },
  { week:8, day:7, quote:"God is love, and he who abides in love abides in God.", source:"1 John 4:16", message:"Abide today. Just abide. That is enough." },
  { week:9, day:1, quote:"Lord Jesus Christ, Son of God, have mercy on me, a sinner.", source:"The Jesus Prayer", message:"Brother, the rope is waiting. One bead at a time." },
  { week:9, day:2, quote:"The name of Jesus is the prayer that never ends.", source:"Desert tradition", message:"Speak His name today. The Fathers did nothing else." },
  { week:9, day:3, quote:"Pray without ceasing.", source:"1 Thessalonians 5:17", message:"Every breath can be a prayer. Come breathe with me." },
  { week:9, day:4, quote:"The Jesus Prayer is the sword of the Spirit.", source:"Abba Macarius", message:"Take up the sword. The desert awaits you." },
  { week:9, day:5, quote:"Keep the name of Jesus on your lips always.", source:"Abba Poemen", message:"His name is on your lips. Return to it." },
  { week:9, day:6, quote:"The heart that holds the Name holds the Kingdom.", source:"Desert tradition", message:"Hold the Name today. That is the whole practice." },
  { week:9, day:7, quote:"In stillness the Jesus Prayer becomes breath.", source:"Hesychast tradition", message:"Let the prayer become breath again. Come still yourself." },
  { week:10, day:1, quote:"Fasting is the soul of prayer.", source:"Tertullian", message:"Brother, the fast is not about food. It is about freedom. Come." },
  { week:10, day:2, quote:"When you fast, anoint your head and wash your face.", source:"Matthew 6:17", message:"Fast from the noise today. Return to silence." },
  { week:10, day:3, quote:"The will that fasts grows strong enough to pray.", source:"Desert tradition", message:"The practice of returning is itself a fast. Come back." },
  { week:10, day:4, quote:"Fasting without prayer is hunger. Prayer without fasting is distraction.", source:"Abba Moses", message:"Combine them today. Fast from one thing. Pray in its place." },
  { week:10, day:5, quote:"The body that is mastered serves the soul.", source:"Abba John Climacus", message:"Return to mastery. One small practice is enough." },
  { week:10, day:6, quote:"Wednesday and Friday are the Church's fast days — ancient, unchanging.", source:"Didache", message:"The tradition holds. Will you hold it with us today?" },
  { week:10, day:7, quote:"He who fasts is light of foot and runs toward God.", source:"St. John Chrysostom", message:"Run toward Him today. The path is still open." },
  { week:11, day:1, quote:"Put on the full armor of God.", source:"Ephesians 6:11", message:"The armor is here. Come put it on." },
  { week:11, day:2, quote:"Our struggle is not against flesh and blood.", source:"Ephesians 6:12", message:"Brother, the real battle is interior. Come fight it here." },
  { week:11, day:3, quote:"Prayer is the weapon the enemy fears most.", source:"Desert tradition", message:"The enemy has had your attention long enough. Come pray." },
  { week:11, day:4, quote:"Resistance to prayer is itself a spiritual attack.", source:"Abba Poemen", message:"The resistance you feel is the reason to return, not the reason to wait." },
  { week:11, day:5, quote:"The demons flee at the name of Jesus.", source:"Desert Fathers", message:"Speak His name. That is the whole battle." },
  { week:11, day:6, quote:"Vigilance and prayer are the two wings of the soul.", source:"Evagrius", message:"Spread both wings today. The desert is wide open." },
  { week:11, day:7, quote:"The one who prays is never alone in battle.", source:"Desert tradition", message:"You are not alone. Come and we will stand together." },
  { week:12, day:1, quote:"God is light, and in him is no darkness at all.", source:"1 John 1:5", message:"Come toward the light. Even one step." },
  { week:12, day:2, quote:"The soul illumined by prayer shines like the sun.", source:"Desert tradition", message:"Brother, the light is waiting to shine through you. Come." },
  { week:12, day:3, quote:"The Transfiguration is not past. It is available.", source:"Hesychast tradition", message:"The mountain is still there. Will you climb today?" },
  { week:12, day:4, quote:"Blessed are the pure in heart, for they shall see God.", source:"Matthew 5:8", message:"Come purify the heart. That is all contemplation asks." },
  { week:12, day:5, quote:"The eye of the soul opens in silence.", source:"Evagrius", message:"Open the eye. Come be still enough to see." },
  { week:12, day:6, quote:"Darkness is not the absence of God. It is the school of trust.", source:"Desert tradition", message:"Even in darkness, come. Especially in darkness, come." },
  { week:12, day:7, quote:"Every prayer is a step toward the light.", source:"Abba Isaiah", message:"Take the step. That is all that is asked today." },
  { week:13, day:1, quote:"I have never preferred my own will to the will of God.", source:"Amma Syncletica", message:"Brother, the Mothers knew the path. Come walk it with them." },
  { week:13, day:2, quote:"Just as a candle cannot burn without fire, we cannot live without prayer.", source:"Amma Syncletica", message:"The candle is lit and waiting. Come." },
  { week:13, day:3, quote:"It is good to live in peace, for the wise man practices perpetual prayer.", source:"Amma Theodora", message:"Return to peace. The Mothers kept it through everything." },
  { week:13, day:4, quote:"Suffering produces endurance, endurance character, character hope.", source:"Romans 5:3-4", message:"Whatever you are carrying — bring it. The desert receives everything." },
  { week:13, day:5, quote:"The woman who prays in secret is heard before the throne.", source:"Desert tradition", message:"The throne hears everything. Come speak." },
  { week:13, day:6, quote:"Amma Sarah lived by the river for sixty years and never looked at it.", source:"Desert Fathers", message:"One thing is necessary. Come back to the one thing." },
  { week:13, day:7, quote:"A word from the Mothers is worth more than years of reading.", source:"Desert tradition", message:"Come hear the word that is waiting for you today." },
  { week:14, day:1, quote:"Not my will but yours be done.", source:"Luke 22:42", message:"Brother, surrender is not defeat. Come practice it." },
  { week:14, day:2, quote:"Obedience is the mother of all virtues.", source:"Abba John Climacus", message:"Return to the practice of surrender. One small yes is enough." },
  { week:14, day:3, quote:"The soul that surrenders its will finds God's.", source:"Desert tradition", message:"Your will has carried you far enough. Come lay it down." },
  { week:14, day:4, quote:"He who holds nothing back receives everything.", source:"Desert Fathers", message:"Hold nothing back today. Come with open hands." },
  { week:14, day:5, quote:"Abandonment to divine providence is the highest prayer.", source:"Jean-Pierre de Caussade", message:"Abandon yourself to this moment. Come." },
  { week:14, day:6, quote:"Fiat. Let it be done to me according to your word.", source:"Luke 1:38", message:"Say fiat today. Even if you don't feel it. Say it." },
  { week:14, day:7, quote:"The surrendered soul rests in God as a child in its mother's arms.", source:"Desert tradition", message:"Rest today. You have been striving long enough." },
  { week:15, day:1, quote:"Give thanks in all circumstances.", source:"1 Thessalonians 5:18", message:"Brother, gratitude is its own form of prayer. Come practice it." },
  { week:15, day:2, quote:"Contentment is great gain.", source:"1 Timothy 6:6", message:"What you already have is enough to pray with. Come." },
  { week:15, day:3, quote:"The grateful heart sees God everywhere.", source:"Desert tradition", message:"Come open the eyes of gratitude today." },
  { week:15, day:4, quote:"Eucharist means thanksgiving. Every prayer is eucharistic.", source:"Desert tradition", message:"Return with a single word of thanks. That is enough." },
  { week:15, day:5, quote:"Count your blessings and your complaints will grow silent.", source:"Desert Fathers", message:"Come count one blessing. Just one." },
  { week:15, day:6, quote:"The monk who is content with little is rich before God.", source:"Abba Moses", message:"You are rich today. Come remember it." },
  { week:15, day:7, quote:"All shall be well, and all shall be well.", source:"Julian of Norwich", message:"All shall be well. Come rest in that today." },
  { week:16, day:1, quote:"Blessed are the poor in spirit, for theirs is the kingdom of heaven.", source:"Matthew 5:3", message:"Brother, come poor. The kingdom belongs to the poor." },
  { week:16, day:2, quote:"Simplicity is the garment of the angels.", source:"Desert tradition", message:"Strip away the complexity today. Come simply." },
  { week:16, day:3, quote:"The cell of a monk contains everything he needs.", source:"Abba Arsenius", message:"The app is your cell. Everything you need is here." },
  { week:16, day:4, quote:"One word from God is worth more than libraries of human wisdom.", source:"Desert Fathers", message:"Come for one word. That is enough." },
  { week:16, day:5, quote:"Seek first the kingdom and all else will be added.", source:"Matthew 6:33", message:"Seek first. Just first. Come." },
  { week:16, day:6, quote:"The poor man is not the one who has nothing but the one who wants nothing.", source:"Desert tradition", message:"Want nothing today but this. Come." },
  { week:16, day:7, quote:"A single word of prayer spoken with the heart outweighs a thousand spoken with the lips.", source:"Abba Macarius", message:"Speak one word with your heart. That is the whole practice." },
  { week:17, day:1, quote:"The fear of the Lord is the beginning of wisdom.", source:"Proverbs 9:10", message:"The question you left unanswered is still here. Come face it." },
  { week:17, day:2, quote:"Holy fear is not terror. It is awe before infinite love.", source:"Desert tradition", message:"Come stand in awe today. Not in dread — in wonder." },
  { week:17, day:3, quote:"He who fears God fears nothing else.", source:"Abba Anthony", message:"What are you afraid of? Bring it. The fear of God dissolves all lesser fears." },
  { week:17, day:4, quote:"The soul that trembles before God does not tremble before anything else.", source:"Desert tradition", message:"Come tremble before the right thing today." },
  { week:17, day:5, quote:"Reverence is the posture of the contemplative.", source:"Desert Fathers", message:"Return to reverence. It is the beginning of everything." },
  { week:17, day:6, quote:"God is not safe. But he is good.", source:"C.S. Lewis", message:"Come to the God who is not safe. He is waiting." },
  { week:17, day:7, quote:"The one who fears God has nothing else to fear.", source:"Abba Poemen", message:"Let the holy fear settle everything else. Come." },
  { week:18, day:1, quote:"Hope does not put us to shame.", source:"Romans 5:5", message:"You have not been abandoned. Come back and you will see." },
  { week:18, day:2, quote:"Perseverance is the virtue that outlasts all others.", source:"Desert tradition", message:"You have returned before. You can return again. Come." },
  { week:18, day:3, quote:"The one who endures to the end will be saved.", source:"Matthew 24:13", message:"Endure today. One more return. That is endurance." },
  { week:18, day:4, quote:"Hope is a theological virtue. It must be received.", source:"CCC 1817", message:"Come receive hope today. You cannot make it yourself." },
  { week:18, day:5, quote:"The night is darkest before dawn.", source:"Desert tradition", message:"If it has been dark — the dawn is closer than you think. Come." },
  { week:18, day:6, quote:"Patient endurance is the crown of the contemplative.", source:"Abba Isaiah", message:"Endure patiently. Return patiently. That is the practice." },
  { week:18, day:7, quote:"He who began a good work in you will carry it to completion.", source:"Philippians 1:6", message:"He has not abandoned the work. Come continue it." },
  { week:19, day:1, quote:"That they may all be one, as you, Father, are in me and I in you.", source:"John 17:21", message:"Union is not a destination. It is a direction. Come face it." },
  { week:19, day:2, quote:"The soul in union with God is like a coal set alight.", source:"St. John of the Cross", message:"You were made to burn. Come." },
  { week:19, day:3, quote:"Deification is the goal of the Christian life.", source:"St. Athanasius", message:"Not self-improvement. Deification. The tradition is vast. Come explore it." },
  { week:19, day:4, quote:"God became man so that man might become God.", source:"St. Athanasius", message:"This is the claim of the tradition. Come wrestle with it." },
  { week:19, day:5, quote:"The mystic life is not exceptional. It is the fullness of baptism.", source:"Desert tradition", message:"You were baptized into this. Come claim it." },
  { week:19, day:6, quote:"Abide in me and I in you.", source:"John 15:4", message:"The invitation has not been withdrawn. Come abide." },
  { week:19, day:7, quote:"The end of prayer is not words but presence.", source:"Desert tradition", message:"Come past the words today. Come into the presence." },
  { week:20, day:1, quote:"Be still and know that I am God.", source:"Psalm 46:10", message:"The knowing comes through the stillness. Come be still." },
  { week:20, day:2, quote:"Stillness is not emptiness. It is fullness waiting to be received.", source:"Hesychast tradition", message:"You have been filling yourself with noise. Come empty yourself." },
  { week:20, day:3, quote:"The contemplative does not find God. God finds the contemplative in the silence.", source:"Desert tradition", message:"Stop searching. Come be found." },
  { week:20, day:4, quote:"In returning and rest you shall be saved. In quietness and trust your strength.", source:"Isaiah 30:15", message:"Return. Rest. That is salvation's shape today." },
  { week:20, day:5, quote:"The still small voice speaks only to those who are still.", source:"1 Kings 19:12", message:"The still small voice is speaking. Come be still enough to hear it." },
  { week:20, day:6, quote:"Hesychia — holy stillness — is the mother of all prayer.", source:"Hesychast tradition", message:"Come to the mother. Come to stillness." },
  { week:20, day:7, quote:"Nothing in all creation is so like God as stillness.", source:"Meister Eckhart", message:"Come be like God today. Come be still." },
  { week:21, day:1, quote:"Love one another as I have loved you.", source:"John 13:34", message:"The practice of prayer makes you capable of this love. Come practice." },
  { week:21, day:2, quote:"The one who loves his neighbor has fulfilled the law.", source:"Romans 13:8", message:"Contemplation and compassion are not separate. Come see why." },
  { week:21, day:3, quote:"What you do to the least of these, you do to me.", source:"Matthew 25:40", message:"Every person you encounter today bears His face. Come prepare yourself." },
  { week:21, day:4, quote:"The monk who has no compassion has no prayer.", source:"Desert tradition", message:"Come let prayer shape you into someone who loves." },
  { week:21, day:5, quote:"Carry one another's burdens.", source:"Galatians 6:2", message:"You cannot carry what you have not first laid down yourself. Come lay it down." },
  { week:21, day:6, quote:"The heart enlarged by prayer can hold more of the world's pain.", source:"Desert tradition", message:"Come enlarge the heart. The world needs it." },
  { week:21, day:7, quote:"Acquire the spirit of peace and thousands around you will be saved.", source:"St. Seraphim of Sarov", message:"Your prayer is not only for you. Come pray for all of them." },
  { week:22, day:1, quote:"I die daily.", source:"1 Corinthians 15:31", message:"The daily death is the daily return. Come die today." },
  { week:22, day:2, quote:"Unless a grain of wheat falls into the earth and dies, it remains alone.", source:"John 12:24", message:"The dying is the bearing of fruit. Come." },
  { week:22, day:3, quote:"Die before you die and discover there is no death.", source:"Desert tradition", message:"Come practice the small death of returning. It leads to life." },
  { week:22, day:4, quote:"The old man must die for the new man to live.", source:"Ephesians 4:22-24", message:"What needs to die today? Bring it. Come." },
  { week:22, day:5, quote:"Every act of surrender is a rehearsal for the final surrender.", source:"Desert tradition", message:"Rehearse it today. Come surrender something." },
  { week:22, day:6, quote:"The cross is not the end of the story. But it is unavoidable.", source:"Desert Fathers", message:"Come face what you have been avoiding. The cross leads somewhere." },
  { week:22, day:7, quote:"He who loses his life for my sake will find it.", source:"Matthew 16:25", message:"Come lose something today. The tradition promises you will find more." },
  { week:23, day:1, quote:"The kingdom of God is within you.", source:"Luke 17:21", message:"You have been looking outward. Come look inward." },
  { week:23, day:2, quote:"The interior life is the only life that lasts.", source:"Desert tradition", message:"Come tend the life that lasts." },
  { week:23, day:3, quote:"All the noise of the world cannot touch the kingdom within.", source:"Desert Fathers", message:"Come inside the kingdom today. The noise cannot follow." },
  { week:23, day:4, quote:"Heaven is not a place you go to. It is a reality you grow into.", source:"Desert tradition", message:"Come grow into it today. One practice at a time." },
  { week:23, day:5, quote:"The kingdom suffers violence and the violent take it by force.", source:"Matthew 11:12", message:"Come take it by force today. Force yourself to return." },
  { week:23, day:6, quote:"Seek the kingdom first. Everything else is commentary.", source:"Matthew 6:33", message:"Put first things first today. Come." },
  { week:23, day:7, quote:"The pearl of great price is worth everything.", source:"Matthew 13:46", message:"You know what it costs. You know what it is worth. Come." },
  { week:24, day:1, quote:"Sit in your cell, and your cell will teach you everything.", source:"Abba Moses", message:"We have come full circle. The beginning is the same as the end. Come sit." },
  { week:24, day:2, quote:"The desert Fathers left everything to find the one thing necessary.", source:"Desert tradition", message:"You have been here 24 weeks. What has the desert taught you? Come reflect." },
  { week:24, day:3, quote:"Return to me with all your heart.", source:"Joel 2:12", message:"Not partially. Not occasionally. With all your heart. Come." },
  { week:24, day:4, quote:"The beginning of prayer is the willingness to begin again.", source:"Desert tradition", message:"Begin again today. As if for the first time. Come." },
  { week:24, day:5, quote:"Every return is a resurrection.", source:"Desert Fathers", message:"You are being raised today. Come." },
  { week:24, day:6, quote:"Our heart is restless until it rests in Thee.", source:"St. Augustine", message:"Has your heart found its rest? Come rest in it today." },
  { week:24, day:7, quote:"The journey inward has no end. That is its beauty.", source:"Desert tradition", message:"There is always more. Come. The desert is infinite and it is all yours." }
];

function getNotification(week, day) {
  return SERIES.find(n => n.week === week && n.day === day) || SERIES[0];
}

async function sendPushNotification(externalId, title, message) {
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [externalId] },
      target_channel: 'push',
      headings: { en: title },
      contents: { en: message },
      url: 'https://stillprayer.app'
    })
  });
  return res.ok;
}

async function getInactiveUsers(serviceKey, daysInactive) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysInactive);
  const res = await fetch(
    `${SUPA_URL}/rest/v1/user_activity?last_active=lt.${cutoff.toISOString()}&select=user_id,notification_week,notification_day`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

async function advanceUserNotification(userId, week, day, serviceKey) {
  let nextDay = day + 1;
  let nextWeek = week;
  if (nextDay > 7) { nextDay = 1; nextWeek = week < 24 ? week + 1 : 1; }
  await fetch(`${SUPA_URL}/rest/v1/user_activity?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ notification_week: nextWeek, notification_day: nextDay })
  });
}

exports.handler = async (event) => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    // Get users inactive for 3+ days
    const inactiveUsers = await getInactiveUsers(serviceKey, 3);

    let sent = 0;
    for (const user of inactiveUsers) {
      const week = user.notification_week || 1;
      const day = user.notification_day || 1;
      const notification = getNotification(week, day);

      const title = `"${notification.quote}" — ${notification.source}`;
      const message = notification.message;

      const success = await sendPushNotification(user.user_id, title, message);
      if (success) {
        await advanceUserNotification(user.user_id, week, day, serviceKey);
        sent++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ sent, total: inactiveUsers.length })
    };

  } catch (err) {
    console.error('Notification error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};