pub(super) fn is_svg(path: &str, data: &[u8]) -> bool {
    if path.to_ascii_lowercase().ends_with(".svg") {
        return true;
    }

    let head = String::from_utf8_lossy(&data[..data.len().min(512)]);
    let head = head.trim_start_matches('\u{feff}').trim_start();
    head.starts_with("<svg") || (head.starts_with("<?xml") && head.contains("<svg"))
}

pub(super) fn process_svg(data: &[u8]) -> Result<Vec<u8>, String> {
    let source = String::from_utf8_lossy(data);
    let minified = minify_svg(&source);

    if minified.len() >= data.len() {
        return Ok(data.to_vec());
    }
    Ok(minified.into_bytes())
}

fn minify_svg(source: &str) -> String {
    let mut text = source.trim_start_matches('\u{feff}').trim().to_string();

    if text.starts_with("<?xml") {
        if let Some(end) = text.find("?>") {
            text = text[end + 2..].trim_start().to_string();
        }
    }

    if text.starts_with("<!DOCTYPE") {
        if let (Some(end), bracket) = (text.find('>'), text.find('[')) {
            if bracket.is_none_or(|bracket| bracket > end) {
                text = text[end + 1..].trim_start().to_string();
            }
        }
    }

    let mut result = remove_block(&text, "<!--", "-->");
    result = remove_element(&result, "<metadata", "</metadata>");

    // 含文本节点或显式保留空白的 SVG 不去动标签间空白，避免改变文字排版
    if !result.contains("<text") && !result.contains("<tspan") && !result.contains("xml:space") {
        result = collapse_between_tags(&result);
    }

    result.trim().to_string()
}

fn remove_block(input: &str, start: &str, end: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;

    while let Some(offset) = input[cursor..].find(start) {
        let start_index = cursor + offset;
        output.push_str(&input[cursor..start_index]);

        match input[start_index..].find(end) {
            Some(end_offset) => cursor = start_index + end_offset + end.len(),
            None => {
                cursor = start_index;
                break;
            }
        }
    }

    output.push_str(&input[cursor..]);
    output
}

fn remove_element(input: &str, start: &str, end: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut cursor = 0;

    while let Some(offset) = input[cursor..].find(start) {
        let start_index = cursor + offset;
        output.push_str(&input[cursor..start_index]);

        let Some(open_end) = input[start_index..]
            .find('>')
            .map(|value| start_index + value)
        else {
            cursor = start_index;
            break;
        };

        if input[start_index..open_end].trim_end().ends_with('/') {
            cursor = open_end + 1;
            continue;
        }

        match input[open_end..].find(end) {
            Some(end_offset) => cursor = open_end + end_offset + end.len(),
            None => {
                cursor = start_index;
                break;
            }
        }
    }

    output.push_str(&input[cursor..]);
    output
}

fn collapse_between_tags(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(current) = chars.next() {
        output.push(current);
        if current != '>' {
            continue;
        }

        let mut whitespace = false;
        while chars.peek().is_some_and(|next| next.is_whitespace()) {
            chars.next();
            whitespace = true;
        }

        if whitespace && chars.peek() != Some(&'<') {
            output.push(' ');
        }
    }

    output
}
