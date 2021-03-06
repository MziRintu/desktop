import * as React from 'react'

import { Repository } from '../../models/repository'
import { Dispatcher } from '../../lib/dispatcher'
import { WorkingDirectoryFileChange } from '../../models/status'
import { Button } from '../lib/button'
import { ButtonGroup } from '../lib/button-group'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { PathText } from '../lib/path-text'
import { Monospaced } from '../lib/monospaced'

interface IDiscardChangesProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly files: ReadonlyArray<WorkingDirectoryFileChange>
  readonly onDismissed: () => void
}

/**
 * If we're discarding any more than this number, we won't bother listing them
 * all.
 */
const MaxFilesToList = 10

/** A component to confirm and then discard changes. */
export class DiscardChanges extends React.Component<IDiscardChangesProps, {}> {
  public render() {
    const trashName = __DARWIN__ ? 'Trash' : 'Recycle Bin'
    return (
      <Dialog
        id="discard-changes"
        title={
          __DARWIN__ ? 'Confirm Discard Changes' : 'Confirm discard changes'
        }
        onDismissed={this.props.onDismissed}
        type="warning"
      >
        <DialogContent>
          {this.renderFileList()}
          <p>
            Changes can be restored by retrieving them from the {trashName}.
          </p>
        </DialogContent>

        <DialogFooter>
          <ButtonGroup destructive={true}>
            <Button type="submit">Cancel</Button>
            <Button onClick={this.discard}>
              {__DARWIN__ ? 'Discard Changes' : 'Discard changes'}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </Dialog>
    )
  }

  private renderFileList() {
    if (this.props.files.length > MaxFilesToList) {
      return <p>Are you sure you want to discard all changes?</p>
    } else {
      return (
        <div>
          <p>Are you sure you want to discard all changes to:</p>
          <ul>
            {this.props.files.map(p =>
              <li key={p.id}>
                <Monospaced>
                  <PathText path={p.path} />
                </Monospaced>
              </li>
            )}
          </ul>
        </div>
      )
    }
  }

  private discard = () => {
    this.props.dispatcher.discardChanges(
      this.props.repository,
      this.props.files
    )
    this.props.dispatcher.closePopup()
  }
}
