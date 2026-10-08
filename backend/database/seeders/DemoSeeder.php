<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Member;
use App\Models\Study;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

/**
 * The design prototype's group, verbatim, plus a finished spring series (Psalms of Ascent).
 *
 * Run with `php artisan migrate:fresh --seed --seeder=DemoSeeder`. Every absolute date is moved
 * by whole weeks so the demo sits where the design does relative to today.
 */
class DemoSeeder extends Seeder
{
    /** The day the prototype treats as today. */
    public const DESIGN_TODAY = '2026-10-07';

    private const MEMBERS = [
        'rachel' => [
            'name' => 'Rachel Owens',
            'tone' => 'sage',
            'gifts' => ['Encouragement', 'Mercy', 'Hospitality'],
            'line' => 'Hosts most weeks. Grows far too many tomatoes.',
            'family' => 'Married to Tom · two boys, Eli (9) and Sam (6)',
            'interests' => 'Gardening, long walks, anything with peaches',
            'good_to_know' => 'Her porch is our second home. Prefers texts over calls.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '10-11'],
                [
                    'kind' => 'anniversary',
                    'label' => 'Rachel & Tom’s anniversary',
                    'md' => '06-03',
                    'year' => 2011,
                ],
            ],
        ],
        'sarah' => [
            'name' => 'Sarah Lindqvist',
            'tone' => 'accent',
            'gifts' => ['Faith', 'Serving', 'Giving'],
            'line' => 'New nurse at St. Luke’s. Bakes cardamom buns for us.',
            'family' => 'Lives with her mom, Ingrid',
            'interests' => 'Pottery, Scandinavian baking',
            'good_to_know' => 'Working some night shifts — may miss a Wednesday here and there.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '03-22'],
                [
                    'kind' => 'event',
                    'label' => 'Started at St. Luke’s',
                    'md' => '09-28',
                    'year' => 2026,
                    'once' => true,
                ],
            ],
        ],
        'mike' => [
            'name' => 'Mike Brennan',
            'tone' => 'sand',
            'gifts' => ['Leadership', 'Teaching', 'Wisdom'],
            'line' => 'Leads most studies. Builds furniture in his garage.',
            'family' => 'Married to Lauren · daughter Ava (14)',
            'interests' => 'Woodworking, Cubs baseball',
            'good_to_know' => 'His dad, Frank, lives two hours away in Peoria.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '01-09'],
                [
                    'kind' => 'anniversary',
                    'label' => 'Mike & Lauren’s anniversary',
                    'md' => '10-18',
                    'year' => 2010,
                ],
                [
                    'kind' => 'event',
                    'label' => 'Frank’s knee surgery',
                    'md' => '10-16',
                    'year' => 2026,
                    'once' => true,
                ],
            ],
        ],
        'michael' => [
            'name' => 'Michael Ortiz',
            'tone' => 'accent',
            'gifts' => ['Evangelism', 'Prayer', 'Encouragement'],
            'line' => 'Training for his first marathon. Always brings coffee.',
            'family' => 'Close with his sister, Dani',
            'interests' => 'Running, coffee, sci-fi novels',
            'good_to_know' => 'Race is in November — he’d love a few people at the finish.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '11-02'],
                [
                    'kind' => 'event',
                    'label' => 'Marathon day',
                    'md' => '11-08',
                    'year' => 2026,
                    'once' => true,
                ],
            ],
        ],
        'grace' => [
            'name' => 'Grace Adeyemi',
            'tone' => 'sage',
            'gifts' => ['Hospitality', 'Administration', 'Mercy'],
            'line' => 'Expecting her first in November. Organizes our meal trains.',
            'family' => 'Married to Tunde · baby girl due November 20',
            'interests' => 'Choir, cooking jollof rice for everyone',
            'good_to_know' => 'Meal train starts the week after the baby comes.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '10-22'],
                [
                    'kind' => 'event',
                    'label' => 'Baby due',
                    'md' => '11-20',
                    'year' => 2026,
                    'once' => true,
                ],
                [
                    'kind' => 'anniversary',
                    'label' => 'Grace & Tunde’s anniversary',
                    'md' => '08-14',
                    'year' => 2021,
                ],
            ],
        ],
        'david' => [
            'name' => 'David Hale',
            'tone' => 'sand',
            'gifts' => ['Knowledge', 'Teaching', 'Shepherding'],
            'line' => 'Our longest-standing member. Knows every bird by its call.',
            'family' => 'Three grown kids, six grandkids',
            'interests' => 'Birdwatching, church history',
            'good_to_know' => 'His wife Margaret passed in 2022. Her birthday in May can be a hard week.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '02-17'],
                ['kind' => 'event', 'label' => 'Remembering Margaret', 'md' => '05-04'],
            ],
        ],
        'hannah' => [
            'name' => 'Hannah Pruitt',
            'tone' => 'accent',
            'gifts' => ['Serving', 'Giving', 'Faith'],
            'line' => 'Trail runner, thrift-store treasure hunter, new puppy mom.',
            'family' => 'Married to Caleb · puppy named Biscuit',
            'interests' => 'Trail running, thrifting',
            'good_to_know' => 'Moving apartments at the end of October — could use help with boxes.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '12-12'],
                [
                    'kind' => 'anniversary',
                    'label' => 'Hannah & Caleb’s anniversary',
                    'md' => '10-28',
                    'year' => 2023,
                ],
                [
                    'kind' => 'event',
                    'label' => 'Moving day',
                    'md' => '10-31',
                    'year' => 2026,
                    'once' => true,
                ],
            ],
        ],
        'ben' => [
            'name' => 'Ben Carter',
            'tone' => 'sage',
            'gifts' => ['Encouragement', 'Serving'],
            'line' => 'Plays guitar when we sing. Newest to the group.',
            'family' => 'Engaged to Priya — wedding in April',
            'interests' => 'Guitar, board games',
            'good_to_know' => 'Joined us this spring after Easter.',
            'dates' => [
                ['kind' => 'birthday', 'md' => '10-30'],
                [
                    'kind' => 'event',
                    'label' => 'Ben & Priya’s wedding',
                    'md' => '04-18',
                    'year' => 2027,
                    'once' => true,
                ],
            ],
        ],
    ];

    private const PRAYERS = [
        [
            'member' => 'sarah',
            'body' => 'Pray for peace and confidence as I settle into my new job — the night shifts have been an adjustment.',
            'added' => '2026-09-28',
            'updates' => [['2026-10-05', 'First full week done. Tired but grateful.']],
        ],
        [
            'member' => 'mike',
            'body' => 'Prayer for my dad’s knee surgery on the 16th, and for the recovery after.',
            'added' => '2026-10-03',
        ],
        [
            'member' => 'hannah',
            'body' => 'Wisdom as we finish packing and sign the new lease.',
            'added' => '2026-10-04',
        ],
        [
            'member' => 'sarah',
            'body' => 'Please pray for my mom’s upcoming appointment and that we get some clear answers.',
            'added' => '2026-09-30',
        ],
        [
            'member' => 'rachel',
            'body' => 'Eli is struggling with his new teacher. Patience for all of us.',
            'added' => '2026-09-24',
        ],
        [
            'member' => 'michael',
            'body' => 'Staying healthy through the last month of training, and good conversations with my running group.',
            'added' => '2026-09-20',
        ],
        [
            'member' => 'grace',
            'body' => 'Healthy last weeks of pregnancy, and peace for Tunde, who’s more nervous than I am.',
            'added' => '2026-09-16',
            'updates' => [['2026-09-30', 'Doctor says everything looks good so far.']],
        ],
        [
            'member' => 'rachel',
            'body' => 'Tom’s job — his team is being restructured.',
            'added' => '2026-09-10',
            'updates' => [['2026-09-24', 'Still waiting to hear. Keeping him in prayer.']],
        ],
        [
            'member' => 'sarah',
            'body' => 'Hearing back about the St. Luke’s position.',
            'added' => '2026-08-12',
            'answered' => '2026-09-09',
            'answer' => 'Got the offer. Starting September 28.',
        ],
        [
            'member' => 'michael',
            'body' => 'Pray for my sister Dani’s job interview.',
            'added' => '2026-08-20',
            'answered' => '2026-09-02',
            'answer' => 'She got the job — and it’s ten minutes from her apartment.',
        ],
        [
            'member' => 'david',
            'body' => 'My scans next week.',
            'added' => '2026-08-05',
            'answered' => '2026-08-19',
            'answer' => 'Everything came back clear. Thank you all for walking with me.',
        ],
        [
            'member' => 'ben',
            'body' => 'Courage to propose — and that she says yes!',
            'added' => '2026-07-15',
            'answered' => '2026-08-01',
            'answer' => 'She said yes.',
        ],
        [
            'member' => 'hannah',
            'body' => 'Safe travel to see Caleb’s grandparents.',
            'added' => '2026-07-01',
            'answered' => '2026-07-14',
            'answer' => 'Every flight on time, and Grandpa Joe loved meeting Biscuit.',
        ],
    ];

    /** Questions the prototype gives studies that have no sections of their own. */
    private const GENERIC_QUESTIONS = [
        'What stood out to you on a first reading?',
        'What does this passage show us about God?',
        'What is one thing to carry into this week?',
    ];

    private const STUDIES = [
        [
            'ref' => 'Romans 8',
            'title' => 'Life in the Spirit',
            'date' => '2026-10-14',
            'passage' => 'Romans 8:1–17',
            'published' => '2026-10-05',
            'description' => 'Chapter 7 ended with Paul’s honest cry: “Who will deliver me?” Chapter 8 answers it. We’ll sit with what it means to be free from condemnation — and to be called children.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Romans 7 left us with Paul’s honest cry: “Who will deliver me out of the body of this death?” Chapter 8 is the answer, and it may be the most loved chapter in the whole letter.\n\nThis week, let’s slow down. Read the first seventeen verses twice before Wednesday — once straight through, and once looking for every promise.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Romans 8:1–2',
                    'text' => 'There is therefore now no condemnation to those who are in Christ Jesus, who don’t walk according to the flesh, but according to the Spirit. For the law of the Spirit of life in Christ Jesus made me free from the law of sin and of death.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What does Paul mean when he says there is “no condemnation”?',
                        'How does life in the Spirit contrast with life in the flesh?',
                        'Where have you personally experienced this tension?',
                    ],
                ],
                [
                    'type' => 'text',
                    'heading' => 'Things to Notice',
                    'body' => "Count how many times “Spirit” appears in verses 1–17. It’s more than in the rest of Romans so far combined.\n\nNotice the family language in verses 14–17: children, adoption, heirs. Paul moves from the courtroom to the kitchen table.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Romans 8:14–15',
                    'text' => 'For as many as are led by the Spirit of God, these are children of God. For you didn’t receive the spirit of bondage again to fear, but you received the Spirit of adoption, by whom we cry, “Abba! Father!”',
                ],
                [
                    'type' => 'reflect',
                    'heading' => 'Application',
                    'body' => 'Is there an old verdict you’re still living under — something you’ve been forgiven for but haven’t set down? Write it on a card this week, and next to it, write verse 1.',
                ],
                [
                    'type' => 'prayer',
                    'heading' => 'Closing Prayer',
                    'body' => 'Father, thank you that we are not condemned but adopted. Teach us to walk by your Spirit this week — at work, at home, and with each other. Amen.',
                ],
            ],
        ],
        [
            'ref' => 'Romans 9',
            'title' => 'God’s Purposes',
            'date' => '2026-10-21',
            'passage' => 'Romans 9:1–24',
            'description' => 'A hard chapter, honestly. We’ll take it slowly and leave room for questions.',
            'status' => 'draft',
            'saved' => '2026-10-06',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => 'Paul begins with grief — “great sorrow and unceasing pain” for his own people. Before we get to the hard theology, let’s notice his heart.',
                ],
            ],
        ],
        [
            'ref' => 'Romans 7',
            'title' => 'The Conflict Within',
            'date' => '2026-10-07',
            'passage' => 'Romans 7:7–25',
            'description' => 'Paul is painfully honest about doing what he doesn’t want to do. We talked about why that honesty is a gift.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => 'Few passages feel as familiar as this one. Paul describes the war inside every believer — and he doesn’t pretend it’s over.',
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Romans 7:15',
                    'text' => 'For I don’t know what I am doing. For I don’t practice what I desire to do; but what I hate, that I do.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'Does it comfort or unsettle you that Paul wrote this?',
                        'What is the law’s role here — friend, enemy, or mirror?',
                        'How does verse 25 change the tone of the whole chapter?',
                    ],
                ],
                [
                    'type' => 'prayer',
                    'heading' => 'Closing Prayer',
                    'body' => 'Lord, we bring you the things we keep doing and the things we keep failing to do. Thank you that the last word is yours. Amen.',
                ],
            ],
        ],
        [
            'ref' => 'Romans 6',
            'title' => 'Alive in Christ',
            'date' => '2026-09-30',
            'passage' => 'Romans 6:1–14',
            'description' => 'If grace covers everything, why not keep sinning? Paul’s answer centers on baptism and a new kind of life.',
        ],
        [
            'ref' => 'Romans 5',
            'title' => 'Peace With God',
            'date' => '2026-09-23',
            'passage' => 'Romans 5:1–11',
            'description' => 'Justified by faith, we have peace — and a hope that doesn’t disappoint, even through suffering.',
        ],
        [
            'ref' => 'Romans 4',
            'title' => 'Faith Like Abraham',
            'date' => '2026-09-16',
            'passage' => 'Romans 4:1–25',
            'description' => 'Abraham believed God, and it was counted to him as righteousness. What did that trust actually look like?',
        ],
        [
            'ref' => 'Romans 3',
            'title' => 'All Have Fallen Short',
            'date' => '2026-09-09',
            'passage' => 'Romans 3:9–26',
            'description' => 'The great leveling: no one is righteous on their own — and the same grace is offered to all.',
        ],
        [
            'ref' => 'Romans 2',
            'title' => 'The Heart of the Matter',
            'date' => '2026-09-02',
            'passage' => 'Romans 2:1–16',
            'description' => 'Paul turns from “them” to “us.” God’s kindness is meant to lead us to repentance.',
        ],
        [
            'ref' => 'Romans 1',
            'title' => 'Not Ashamed',
            'date' => '2026-08-26',
            'passage' => 'Romans 1:1–17',
            'description' => 'We began the letter with Paul’s greeting and his thesis: the gospel is the power of God for salvation.',
        ],
        [
            'ref' => 'James 5',
            'title' => 'Patient Like a Farmer',
            'date' => '2026-07-29',
            'passage' => 'James 5:7–20',
            'description' => 'Waiting for rain, praying for the sick, and the quiet power of a righteous person’s prayer.',
        ],
        [
            'ref' => 'James 4',
            'title' => 'Draw Near',
            'date' => '2026-07-22',
            'passage' => 'James 4:1–10',
            'description' => 'Where quarrels come from, and the promise that God draws near to those who draw near to him.',
        ],
        [
            'ref' => 'James 3',
            'title' => 'Taming the Tongue',
            'date' => '2026-07-15',
            'passage' => 'James 3:1–18',
            'description' => 'A small spark, a great forest. Wisdom from above shows up in how we speak.',
        ],
        [
            'ref' => 'James 2',
            'title' => 'Faith That Works',
            'date' => '2026-07-08',
            'passage' => 'James 2:14–26',
            'description' => 'Faith without works is dead. We wrestled with how this fits with Romans.',
        ],
        [
            'ref' => 'James 1',
            'title' => 'Joy in Trials',
            'date' => '2026-07-01',
            'passage' => 'James 1:1–18',
            'description' => 'Count it all joy — not because trials are good, but because of what they grow in us.',
        ],
    ];

    private const PSALMS_OF_ASCENT = [
        [
            'ref' => 'Psalm 120',
            'title' => 'Far From Home',
            'date' => '2026-04-01',
            'passage' => 'Psalm 120:1–7',
            'description' => 'The first song pilgrims sang on the road up to Jerusalem starts far from home, in distress — and with a God who answers.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Psalms 120–134 are the Songs of Ascent, sung by travelers walking up to Jerusalem for the feasts. This spring we’ll walk the first eight together.\n\nThe journey starts somewhere surprising: not at the city gates, but far away, among people who don’t want peace. Every pilgrimage begins with knowing you aren’t home yet.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 120:1–2',
                    'text' => 'In my distress, I cried to Yahweh. He answered me. Deliver my soul, Yahweh, from lying lips, from a deceitful tongue.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'Where do you feel “far from home” right now?',
                        'The psalmist says “He answered me” before he describes the trouble. Why might that order matter?',
                        'What would it look like to be a person of peace this week?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 121',
            'title' => 'Where Help Comes From',
            'date' => '2026-04-08',
            'passage' => 'Psalm 121:1–8',
            'description' => 'Lifting our eyes past the hills to the one who made them. He doesn’t slumber, and he won’t let your foot slip.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Pilgrims on the road could see the hills ahead — beautiful, and full of danger. This psalm is a conversation on the way: one voice asks where help comes from, and another answers.\n\nNotice how many times the word “keep” shows up. It’s the heartbeat of the whole song.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 121:1–2',
                    'text' => 'I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What “hills” are you looking at this season?',
                        'Which promise in verses 3–8 is easiest for you to believe? Which is hardest?',
                        'Who has been part of God’s keeping in your life lately?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 122',
            'title' => 'Glad to Go Up',
            'date' => '2026-04-15',
            'passage' => 'Psalm 122:1–9',
            'description' => 'The pilgrims reach the gates. We talked about why gathering with God’s people is meant to be a gladness, not a chore.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "After two psalms on the road, we finally arrive. The city is crowded, the tribes are together, and the first word is joy.\n\nThis is a good week to give thanks for this group — and to pray for the peace of the people around us.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 122:1',
                    'text' => 'I was glad when they said to me, “Let’s go to Yahweh’s house!”',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'When has coming together with other believers felt like gladness to you?',
                        'What does it mean to “pray for the peace of Jerusalem” today?',
                        'How could we make this group a place others are glad to come to?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 123',
            'title' => 'Eyes on the Master',
            'date' => '2026-04-22',
            'passage' => 'Psalm 123:1–4',
            'description' => 'A short, honest prayer for mercy from people who have had more than enough of contempt.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Only four verses, and almost all of it is looking. Servants watch their master’s hand; we watch God’s, and wait for mercy.\n\nIt’s a psalm for weary weeks — when the best prayer we can manage is “have mercy on us.”",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 123:1–2',
                    'text' => 'To you I do lift up my eyes, you who sit in the heavens. Behold, as the eyes of servants look to the hand of their master, as the eyes of a maid to the hand of her mistress; so our eyes look to Yahweh, our God, until he has mercy on us.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What does it look like, practically, to keep your eyes on God?',
                        'Where have you felt worn down by other people’s contempt lately?',
                        'Is it hard for you to simply ask for mercy? Why?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 124',
            'title' => 'If Not for the Lord',
            'date' => '2026-04-29',
            'passage' => 'Psalm 124:1–8',
            'description' => 'Looking back at the floods we didn’t drown in, and naming who kept us afloat.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "This psalm asks us to imagine the other version of our story — the one where God wasn’t on our side. It isn’t meant to scare us, but to make us grateful.\n\nCome ready to share one “if not for the Lord” moment from your own life.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 124:7–8',
                    'text' => 'Our soul has escaped like a bird out of the fowler’s snare. The snare is broken, and we have escaped. Our help is in Yahweh’s name, who made heaven and earth.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What is one “if not for the Lord” moment in your story?',
                        'Why do you think the psalm repeats its opening line?',
                        'How can we help each other remember God’s faithfulness?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 125',
            'title' => 'Like Mount Zion',
            'date' => '2026-05-06',
            'passage' => 'Psalm 125:1–5',
            'description' => 'Those who trust in the Lord can’t be moved. What does steadiness look like in an unsteady season?',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Mountains don’t move, and Jerusalem was ringed by them. The psalmist looked at those hills and saw a picture of God’s people — held, surrounded, steady.\n\nThis week, notice what is shaking in your life, and what isn’t.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 125:1–2',
                    'text' => 'Those who trust in Yahweh are as Mount Zion, which can’t be moved, but remains forever. As the mountains surround Jerusalem, so Yahweh surrounds his people from this time forward and forever more.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What makes you feel unsteady right now?',
                        'How is trust different from never being afraid?',
                        'Who in your life has been a picture of steady faith?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 126',
            'title' => 'Sowing in Tears',
            'date' => '2026-05-13',
            'passage' => 'Psalm 126:1–6',
            'description' => 'Restoration, laughter, and the promise that seed sown in tears comes back as songs of joy.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "The psalm remembers a time when God restored his people and it felt like a dream — mouths full of laughter. Then it turns and asks him to do it again.\n\nIt holds both together: joy remembered and tears still falling. Most of us live right there.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 126:5–6',
                    'text' => 'Those who sow in tears will reap in joy. He who goes out weeping, carrying seed for sowing, will certainly come again with joy, carrying his sheaves.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'When has God restored something in a way that felt like a dream?',
                        'What are you sowing in tears right now?',
                        'How can we carry each other through the hard seasons?',
                    ],
                ],
            ],
        ],
        [
            'ref' => 'Psalm 127',
            'title' => 'Unless the Lord Builds',
            'date' => '2026-05-20',
            'passage' => 'Psalm 127:1–5',
            'description' => 'Work, rest, and family — and the freedom of not having to hold everything together ourselves.',
            'sections' => [
                [
                    'type' => 'text',
                    'heading' => 'Opening Thought',
                    'body' => "Solomon’s psalm, right in the middle of the collection, is about houses, cities, and children — the things we spend our lives building.\n\nIt doesn’t tell us to stop working. It tells us who is really doing the building, and it calls sleep a gift.",
                ],
                [
                    'type' => 'scripture',
                    'ref' => 'Psalm 127:1–2',
                    'text' => 'Unless Yahweh builds the house, they labor in vain who build it. Unless Yahweh watches over the city, the watchman guards it in vain. It is vain for you to rise up early, to stay up late, eating the bread of toil; for he gives sleep to his loved ones.',
                ],
                [
                    'type' => 'questions',
                    'heading' => 'Discussion Questions',
                    'items' => [
                        'What are you trying to build in your own strength right now?',
                        'Why do you think rest shows up in a psalm about work?',
                        'What would it look like to receive sleep as a gift this week?',
                    ],
                ],
                [
                    'type' => 'prayer',
                    'heading' => 'Closing Prayer',
                    'body' => 'Lord, you build the house and you keep the city. Thank you for walking with us through these songs this spring. Teach us to work hard, rest well, and trust you with what we can’t hold. Amen.',
                ],
            ],
        ],
    ];

    /** The prototype's ACTIVITY feed, oldest first so same-day entries keep its order. */
    private const ACTIVITY = [
        ['prayer_added', 'New prayer request for Mike', '2026-10-03'],
        ['prayer_added', 'New prayer request for Hannah', '2026-10-04'],
        ['prayer_updated', 'Sarah’s request has an update', '2026-10-05'],
        ['study_published', 'Romans 8 study notes were published', '2026-10-05'],
    ];

    /** Days added to every absolute date. */
    private int $shift = 0;

    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        $this->shift = self::shiftDays();

        $this->seedPrayers($this->seedMembers());
        $this->seedStudies();
        $this->seedActivity();
    }

    /**
     * Whole weeks from the prototype's today to the real one, so Wednesdays stay Wednesdays.
     */
    public static function shiftDays(): int
    {
        return (int) floor(Carbon::parse(self::DESIGN_TODAY)->diffInDays(today(), false) / 7) * 7;
    }

    /**
     * @return array<string, Member> Keyed by the prototype's member id.
     */
    private function seedMembers(): array
    {
        return array_map(function (array $data): Member {
            $member = Member::create(Arr::except($data, 'dates'));

            foreach ($data['dates'] as $date) {
                $once = $date['once'] ?? false;
                $on = $once ? $this->day("{$date['year']}-{$date['md']}") : Carbon::parse("2000-{$date['md']}");

                $member->dates()->create([
                    'kind' => $date['kind'],
                    'label' => $date['label'] ?? null,
                    'month' => $on->month,
                    'day' => $on->day,
                    'year' => $once ? $on->year : ($date['year'] ?? null),
                    'recurring' => ! $once,
                ]);
            }

            return $member;
        }, self::MEMBERS);
    }

    /**
     * @param  array<string, Member>  $members
     */
    private function seedPrayers(array $members): void
    {
        foreach (self::PRAYERS as $data) {
            $updates = $data['updates'] ?? [];
            $answered = isset($data['answered']);

            $prayer = $members[$data['member']]->prayers()->forceCreate([
                'body' => $data['body'],
                'status' => $answered ? 'answered' : 'active',
                'answer' => $data['answer'] ?? null,
                'answered_at' => $answered ? $this->at($data['answered']) : null,
                'created_at' => $this->at($data['added']),
                'updated_at' => $this->at($data['answered'] ?? Arr::last($updates)[0] ?? $data['added']),
            ]);

            foreach ($updates as [$date, $body]) {
                $prayer->updates()->forceCreate([
                    'body' => $body,
                    'created_at' => $this->at($date),
                    'updated_at' => $this->at($date),
                ]);
            }
        }
    }

    private function seedStudies(): void
    {
        foreach (self::STUDIES as $data) {
            $this->createStudy($data);
        }

        foreach (self::PSALMS_OF_ASCENT as $data) {
            $this->createStudy(['series' => 'Psalms of Ascent', ...$data]);
        }
    }

    /**
     * Published studies went up two days before they met unless the data says otherwise.
     *
     * @param  array<string, mixed>  $data
     */
    private function createStudy(array $data): void
    {
        $status = $data['status'] ?? 'published';
        $publishedAt = $status === 'published'
            ? $this->at($data['published'] ?? Carbon::parse($data['date'])->subDays(2)->toDateString())
            : null;
        $savedAt = $publishedAt ?? $this->at($data['saved']);

        Study::forceCreate([
            'series' => $data['series'] ?? null,
            'ref' => $data['ref'],
            'title' => $data['title'],
            'passage' => $data['passage'],
            'meeting_date' => $this->day($data['date']),
            'description' => $data['description'],
            'sections' => Study::sanitizeSections($data['sections'] ?? [
                ['type' => 'text', 'heading' => 'Opening Thought', 'body' => $data['description']],
                ['type' => 'questions', 'heading' => 'Discussion Questions', 'items' => self::GENERIC_QUESTIONS],
            ]),
            'status' => $status,
            'published_at' => $publishedAt,
            'created_at' => $savedAt,
            'updated_at' => $savedAt,
        ]);
    }

    private function seedActivity(): void
    {
        foreach (self::ACTIVITY as [$kind, $text, $date]) {
            Activity::forceCreate([
                'kind' => $kind,
                'text' => $text,
                'created_at' => $this->at($date),
                'updated_at' => $this->at($date),
            ]);
        }
    }

    /**
     * A prototype calendar date, shifted.
     */
    private function day(string $date): Carbon
    {
        return Carbon::parse($date)->addDays($this->shift);
    }

    /**
     * A prototype date as a timestamp: 19:00 UTC that day, shifted.
     */
    private function at(string $date): Carbon
    {
        return Carbon::parse("{$date} 19:00:00", 'UTC')->addDays($this->shift);
    }
}
