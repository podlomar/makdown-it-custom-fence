module.exports = function custom_fence(md, name, options) {

  // Second param may be useful if you decide
  // to increase minimal allowed marker length
  function validateDefault(params/*, markup*/) {
    return params.trim().split(' ', 2)[0] === name;
  }

  function renderDefault(tokens, idx, _options, env, slf) {
    return `<div class="${name}">\n${tokens[idx].content}\n</div>\n`;
  }

  options = options || {};

  const min_markers = options.min_markers || 3;
  const marker_open = options.marker_open || '[';
  const marker_close = options.marker_close || ']';
  const validate = options.validate || validateDefault;
  const render = options.render || renderDefault;

  console.log('render', render);

  function container(state, startLine, endLine, silent) {
    var pos, nextLine, marker_count, markup, params, token,
        auto_closed = false,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    if (marker_open !== state.src[start]) { 
      return false;
    }

    // Check out the rest of the marker string
    //
    for (pos = start + 1; pos <= max; pos++) {
      if (marker_open !== state.src[pos]) {
        break;
      }
    }

    marker_count = pos - start;
    if (marker_count < min_markers) { 
      return false; 
    }

    markup = state.src.slice(start, pos);
    params = state.src.slice(pos, max).trim();
    if (!validate(params, markup)) { 
      return false; 
    }

    // Since start is found, we can report success here in validation mode
    if (silent) { 
      return true; 
    }

    // Search for the end of the block
    //
    nextLine = startLine;

    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      if (marker_close !== state.src[start]) { 
        continue; 
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      for (pos = start + 1; pos <= max; pos++) {
        if (marker_close !== state.src[pos]) {
          break;
        }
      }

      // closing code fence must be at least as long as the opening one
      if ((pos - start) < marker_count) { 
        continue; 
      }

      // make sure tail has spaces only
      pos = state.skipSpaces(pos);

      if (pos < max) { 
        continue; 
      }

      // found!
      auto_closed = true;
      break;
    }

    token = state.push('custom_fence', 'div', 0);
    token.markup = markup;
    token.block = true;
    token.content = state.src.slice(state.bMarks[startLine + 1], state.eMarks[nextLine - 1]);
    token.meta = {
      fence_type: name,
      params,
    },
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  md.block.ruler.before('fence', 'custom_fence', container, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  });
  md.renderer.rules['custom_fence'] = render;
};