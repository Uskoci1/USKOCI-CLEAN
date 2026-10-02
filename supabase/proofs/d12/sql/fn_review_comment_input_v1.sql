declare v text; n text;
begin
 -- Absent: SQL NULL, JSON null, or a string with nothing but white space. Nothing is stored for an absent comment and a later comment can never be added (the review is immutable).
 if p_comment is null or jsonb_typeof(p_comment)='null' then return null; end if;
 if jsonb_typeof(p_comment)<>'string' then raise exception 'REVIEW_COMMENT_INVALID' using errcode='22023'; end if;
 if octet_length(p_comment::text)>{{COMMENT_JSON_MAX_OCTETS}} then raise exception 'REVIEW_COMMENT_TOO_LONG' using errcode='22023'; end if;
 v:=p_comment#>>'{}';
 -- "No comment": white space (an EXPLICIT class: ASCII white space U+0009..U+000D and U+0020, U+0085 and the Unicode separators; never the locale dependent POSIX class, so U+001C..U+001F are not blank and a lone one is INVALID in every
 -- locale), characters that render as nothing but are tolerated inside a sentence (soft hyphen, combining grapheme joiner, braille blank), the two joiners and ALL sixteen variation selectors ONLY. Every class below is built from chr() pieces:
 -- no escape text, no invisible character in this source. The forbidden class below is every default-ignorable code point of Unicode 17.0 except those allowed-inside groups, plus the controls (see README_D12_CANDIDATE.md, Text rules).
 if btrim(v,E' \n')='' or v ~ {{COMMENT_BLANK_EXPR}} then return null; end if;
 -- The length is counted in code points of the text as sent; the octet cap is defence in depth (500 code points are at most 2000 octets, so it can never fire first). The server REJECTS, it never normalises (the client compares the echoed text).
 if char_length(v)>{{COMMENT_MAX_CHARS}} or octet_length(v)>{{COMMENT_MAX_OCTETS}} then raise exception 'REVIEW_COMMENT_TOO_LONG' using errcode='22023'; end if;
 if v<>btrim(v,E' \n') or v ~ {{COMMENT_FORBIDDEN_EXPR}} then raise exception 'REVIEW_COMMENT_INVALID' using errcode='22023'; end if;
 -- Deterministic contact floor (no AI, no provider): e-mail, link, @handle and a phone number that starts with 0, 00, + or 381 (8 to 13 digits, not a date shape) are refused with ONE plain code (the live PKG-029c floor). It runs on the text as sent
 -- AND on an NFKC-normalised copy without invisible characters and with Arabic-Indic and Persian digits mapped to ASCII, so full-width digits or '@', a soft hyphen or a zero-width joiner inside a number do not hide it; the STORED text is the original.
 -- It is a screen against careless contact details, NOT privacy protection: a number without its leading 0 or 381, 7-digit runs, digits split by letters or by combining marks, digits of other numeral systems (for example Devanagari),
 -- spelled-out numbers, bare domains, short links and handles without @ pass.
 n:=translate(regexp_replace(normalize(v,NFKC),{{COMMENT_STRIP_EXPR}},'','g'),{{COMMENT_DIGITS_FROM_EXPR}},'{{COMMENT_DIGITS_TO}}');
 if private.ru4b_public_floor_reason(v) is not null or private.ru4b_public_floor_reason(n) is not null then raise exception 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC' using errcode='22023'; end if;
 return v;
end;
